const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_FILE = 'data/content.json';
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

function asTrimmedString(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function sanitizeArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`Format invalide : ${label} manquant.`);
  }

  return value;
}

function sanitizeObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Format invalide : ${label} incorrect.`);
  }

  return value;
}

function sanitizeSeo(value, label) {
  const seo = sanitizeObject(value, label);
  const title = asTrimmedString(seo.title);
  const description = asTrimmedString(seo.description);

  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description
  };
}

function sanitizeShared(value) {
  const shared = sanitizeObject(value, 'shared');

  return {
    brandName: asTrimmedString(shared.brandName),
    brandRole: asTrimmedString(shared.brandRole),
    bookingLabel: asTrimmedString(shared.bookingLabel),
    bookingUrl: asTrimmedString(shared.bookingUrl),
    addressText: asTrimmedString(shared.addressText),
    secondaryAddressText: asTrimmedString(shared.secondaryAddressText),
    mapsUrl: asTrimmedString(shared.mapsUrl),
    secondaryMapsUrl: asTrimmedString(shared.secondaryMapsUrl),
    footerCopyName: asTrimmedString(shared.footerCopyName)
  };
}

function sanitizeBodymap(value, currentValue = {}) {
  const bodymap = sanitizeObject(value, 'home.bodymap');
  const currentBodymap = sanitizeObject(currentValue || {}, 'home.bodymap actuel');

  const hotspots = sanitizeArray(bodymap.hotspots || [], 'home.bodymap.hotspots');
  const lockerItems = sanitizeArray(bodymap.lockerItems || [], 'home.bodymap.lockerItems');
  const currentHotspots = Array.isArray(currentBodymap.hotspots) ? currentBodymap.hotspots : [];
  const currentLockerItems = Array.isArray(currentBodymap.lockerItems) ? currentBodymap.lockerItems : [];

  return {
    title: asTrimmedString(bodymap.title),
    hotspots: hotspots.map((raw, index) => {
      const item = sanitizeObject(raw, 'home.bodymap.hotspot');
      const currentItem = sanitizeObject(currentHotspots[index] || {}, 'home.bodymap.hotspot actuel');

      return {
        label: asTrimmedString(currentItem.label),
        title: asTrimmedString(item.title),
        text: asTrimmedString(item.text),
        className: asTrimmedString(currentItem.className)
      };
    }),
    lockerTitle: asTrimmedString(bodymap.lockerTitle),
    lockerDefaultTitle: asTrimmedString(bodymap.lockerDefaultTitle),
    lockerDefaultText: asTrimmedString(bodymap.lockerDefaultText),
    lockerItems: lockerItems.map((raw, index) => {
      const item = sanitizeObject(raw, 'home.bodymap.lockerItem');
      const currentItem = sanitizeObject(currentLockerItems[index] || {}, 'home.bodymap.lockerItem actuel');

      return {
        label: asTrimmedString(currentItem.label),
        title: asTrimmedString(item.title),
        text: asTrimmedString(item.text)
      };
    })
  };
}

function sanitizeReviews(value) {
  const reviews = sanitizeObject(value, 'home.reviews');
  const items = sanitizeArray(reviews.items || [], 'home.reviews.items');

  return {
    title: asTrimmedString(reviews.title),
    items: items.map((raw) => {
      const item = sanitizeObject(raw, 'home.reviews.item');

      return {
        quote: asTrimmedString(item.quote),
        text: asTrimmedString(item.text),
        name: asTrimmedString(item.name)
      };
    })
  };
}

function sanitizeServices(value) {
  const services = sanitizeArray(value, 'prestations.services');

  return services.map((raw) => {
    const service = sanitizeObject(raw, 'prestations.service');

    return {
      id: asTrimmedString(service.id),
      name: asTrimmedString(service.name),
      sub: asTrimmedString(service.sub),
      price: asTrimmedString(service.price),
      bookingUrl: asTrimmedString(service.bookingUrl),
      details: sanitizeArray(service.details || [], `prestations.service.details (${service.id || service.name || 'service'})`)
        .map((item) => asTrimmedString(item))
        .filter(Boolean)
    };
  });
}

function sanitizeContentPayload(payload, currentContent = {}) {
  const content = sanitizeObject(payload, 'contenu');
  const shared = sanitizeShared(content.shared);
  const home = sanitizeObject(content.home, 'home');
  const prestations = sanitizeObject(content.prestations, 'prestations');
  const currentHome = sanitizeObject(currentContent.home || {}, 'home actuel');
  const currentHero = sanitizeObject(currentHome.hero || {}, 'home.hero actuel');
  const currentBodymap = sanitizeObject(currentHome.bodymap || {}, 'home.bodymap actuel');

  const nextContent = {
    updatedAt: new Date().toISOString(),
    shared,
    home: {
      seo: sanitizeSeo(home.seo, 'home.seo'),
      hero: {
        kicker: asTrimmedString(home.hero?.kicker),
        title: asTrimmedString(home.hero?.title),
        text: asTrimmedString(home.hero?.text),
        brand: asTrimmedString(home.hero?.brand),
        ctaLabel: asTrimmedString(home.hero?.ctaLabel),
        ctaUrl: asTrimmedString(currentHero.ctaUrl)
      },
      bodymap: sanitizeBodymap(home.bodymap, currentBodymap),
      reviews: sanitizeReviews(home.reviews),
      schedule: {
        title: asTrimmedString(home.schedule?.title),
        subtitle: asTrimmedString(home.schedule?.subtitle)
      },
      localLinksTitle: asTrimmedString(currentHome.localLinksTitle)
    },
    prestations: {
      seo: sanitizeSeo(prestations.seo, 'prestations.seo'),
      title: asTrimmedString(prestations.title),
      stepLabel: asTrimmedString(prestations.stepLabel),
      summaryTitle: asTrimmedString(prestations.summaryTitle),
      summaryCabinetName: asTrimmedString(prestations.summaryCabinetName),
      summaryCabinetRole: asTrimmedString(prestations.summaryCabinetRole),
      summaryHint: asTrimmedString(prestations.summaryHint),
      services: sanitizeServices(prestations.services)
    }
  };

  if (!nextContent.shared.brandName || !nextContent.shared.bookingUrl) {
    throw new Error('Format invalide : informations partagées incomplètes.');
  }

  return nextContent;
}

async function readContentFromFileSystem() {
  const absolutePath = path.join(process.cwd(), DATA_FILE);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return {
    data: JSON.parse(raw),
    sha: null
  };
}

async function readContentFromGithub() {
  const response = await fetch(getRepoApiUrl(DATA_FILE), {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cabinet-tabert-content-api'
    }
  });

  if (!response.ok) {
    throw new Error(`Impossible de lire le contenu depuis GitHub (${response.status}).`);
  }

  const payload = await response.json();
  const content = Buffer.from(payload.content, 'base64').toString('utf8');

  return {
    data: JSON.parse(content),
    sha: payload.sha
  };
}

async function loadContent() {
  if (GITHUB_TOKEN) {
    try {
      return await readContentFromGithub();
    } catch (error) {
      console.error(error);
    }
  }

  return readContentFromFileSystem();
}

async function writeContentToGithub(nextData, currentSha) {
  if (!GITHUB_TOKEN) {
    throw new Error('La variable GITHUB_TOKEN est manquante.');
  }

  const response = await fetch(getRepoApiUrl(DATA_FILE), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'cabinet-tabert-content-api'
    },
    body: JSON.stringify({
      message: 'Update website content',
      content: Buffer.from(JSON.stringify(nextData, null, 2) + '\n', 'utf8').toString('base64'),
      branch: GITHUB_BRANCH,
      sha: currentSha || undefined
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Impossible d'enregistrer le contenu sur GitHub (${response.status}) : ${errorText}`);
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
      const { data } = await loadContent();
      sendJson(res, 200, data);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: 'Impossible de charger le contenu.' });
    }
    return;
  }

  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: 'Mot de passe invalide.' });
      return;
    }

    try {
      const current = await loadContent();
      const nextData = sanitizeContentPayload(getRequestBody(req), current.data);
      await writeContentToGithub(nextData, current.sha);
      sendJson(res, 200, nextData);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: error.message || 'Impossible d’enregistrer le contenu.' });
    }
    return;
  }

  res.setHeader('Allow', 'GET,POST,OPTIONS');
  sendJson(res, 405, { error: 'Méthode non autorisée.' });
};
