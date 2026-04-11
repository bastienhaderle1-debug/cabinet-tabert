const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_FILE = 'data/hours.json';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'bastienhaderle1-debug';
const GITHUB_REPO = process.env.GITHUB_REPO || 'cabinet-tabert';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowAnyOrigin = !origin || origin === 'null';

  if (allowAnyOrigin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password, Accept');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function getRepoApiUrl(filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedPath}`;
}

function isValidScheduleEntry(entry) {
  return entry
    && typeof entry.day === 'string'
    && entry.day.trim()
    && typeof entry.time === 'string'
    && entry.time.trim();
}

function sanitizeHoursPayload(payload) {
  if (!payload || !Array.isArray(payload.cabinets)) {
    throw new Error('Format invalide : cabinets manquant.');
  }

  const cabinets = payload.cabinets.map((cabinet) => {
    if (!cabinet || typeof cabinet !== 'object') {
      throw new Error('Format invalide : cabinet incorrect.');
    }

    if (!Array.isArray(cabinet.schedules)) {
      throw new Error(`Format invalide : horaires manquants pour ${cabinet.name || cabinet.id || 'un cabinet'}.`);
    }

    const schedules = cabinet.schedules
      .filter(isValidScheduleEntry)
      .map((entry) => ({
        day: entry.day.trim(),
        time: entry.time.replace(/\r\n/g, '\n').trim()
      }));

    return {
      id: String(cabinet.id || '').trim(),
      name: String(cabinet.name || '').trim(),
      address: String(cabinet.address || '').trim(),
      ctaLabel: String(cabinet.ctaLabel || '').trim(),
      ctaUrl: String(cabinet.ctaUrl || '').trim(),
      schedules
    };
  });

  if (cabinets.some((cabinet) => !cabinet.id || !cabinet.name || !cabinet.address || !cabinet.ctaLabel || !cabinet.ctaUrl)) {
    throw new Error('Format invalide : informations cabinet incomplètes.');
  }

  return {
    updatedAt: new Date().toISOString(),
    cabinets
  };
}

async function readHoursFromFileSystem() {
  const absolutePath = path.join(process.cwd(), DATA_FILE);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return {
    data: JSON.parse(raw),
    sha: null
  };
}

async function readHoursFromGithub() {
  const response = await fetch(getRepoApiUrl(DATA_FILE), {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cabinet-tabert-hours-api'
    }
  });

  if (!response.ok) {
    throw new Error(`Impossible de lire les horaires depuis GitHub (${response.status}).`);
  }

  const payload = await response.json();
  const content = Buffer.from(payload.content, 'base64').toString('utf8');

  return {
    data: JSON.parse(content),
    sha: payload.sha
  };
}

async function loadHours() {
  if (GITHUB_TOKEN) {
    try {
      return await readHoursFromGithub();
    } catch (error) {
      console.error(error);
    }
  }

  return readHoursFromFileSystem();
}

async function writeHoursToGithub(nextData, currentSha) {
  if (!GITHUB_TOKEN) {
    throw new Error('La variable GITHUB_TOKEN est manquante.');
  }

  const response = await fetch(getRepoApiUrl(DATA_FILE), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'cabinet-tabert-hours-api'
    },
    body: JSON.stringify({
      message: 'Update cabinet schedules',
      content: Buffer.from(JSON.stringify(nextData, null, 2) + '\n', 'utf8').toString('base64'),
      branch: GITHUB_BRANCH,
      sha: currentSha || undefined
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Impossible d'enregistrer les horaires sur GitHub (${response.status}) : ${errorText}`);
  }

  return response.json();
}

function isAuthorized(req) {
  if (!ADMIN_PASSWORD) return false;
  const providedPassword = req.headers['x-admin-password'];
  return typeof providedPassword === 'string' && providedPassword === ADMIN_PASSWORD;
}

function getRequestBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  return req.body;
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    res.end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const { data } = await loadHours();
      sendJson(res, 200, data);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: 'Impossible de charger les horaires.' });
    }
    return;
  }

  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: 'Mot de passe invalide.' });
      return;
    }

    try {
      const current = await loadHours();
      const nextData = sanitizeHoursPayload(getRequestBody(req));
      await writeHoursToGithub(nextData, current.sha);
      sendJson(res, 200, nextData);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: error.message || 'Impossible d’enregistrer les horaires.' });
    }
    return;
  }

  res.setHeader('Allow', 'GET,POST,OPTIONS');
  sendJson(res, 405, { error: 'Méthode non autorisée.' });
};
