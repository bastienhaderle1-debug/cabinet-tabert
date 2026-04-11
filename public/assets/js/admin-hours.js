(function () {
  const PRODUCTION_ORIGIN = 'https://www.carol-anne-chiropraxie.fr';
  const currentOrigin = window.location.origin;
  const isLocalContext = window.location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const apiBase = (() => {
    const configured = document.documentElement.getAttribute('data-api-base')
      || window.localStorage.getItem('adminApiBase')
      || window.localStorage.getItem('siteApiBase');

    if (configured) {
      return configured.replace(/\/$/, '');
    }

    if (isLocalContext) {
      return PRODUCTION_ORIGIN;
    }

    return currentOrigin.replace(/\/$/, '');
  })();

  const contentEditor = document.getElementById('content-editor');
  const scheduleEditor = document.getElementById('schedule-editor');
  const passwordInput = document.getElementById('admin-password');
  const saveAllButton = document.getElementById('save-all-button');
  const saveContentButton = document.getElementById('save-content-button');
  const saveHoursButton = document.getElementById('save-hours-button');
  const contentStatusNode = document.getElementById('content-status');
  const contentMetaNode = document.getElementById('content-meta');
  const hoursStatusNode = document.getElementById('hours-status');
  const hoursMetaNode = document.getElementById('hours-meta');

  let contentState = null;
  let hoursState = null;

  function buildApiUrl(path) {
    return `${apiBase}${path}`;
  }

  function getFriendlyError(error, fallbackMessage) {
    const message = String(error && error.message ? error.message : fallbackMessage || '').trim();

    if (!message) {
      return fallbackMessage;
    }

    if (/failed to fetch|networkerror/i.test(message)) {
      if (isLocalContext) {
        return `Connexion impossible à l'API (${apiBase}). Ouvrez la page via Vercel, ou définissez une autre API avec localStorage.adminApiBase.`;
      }

      return `Connexion impossible à l'API (${apiBase}).`;
    }

    return message;
  }

  async function parseApiJson(response, fallbackMessage) {
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    if (!contentType.includes('application/json')) {
      const snippet = raw.trim().slice(0, 120);
      throw new Error(`L'API (${apiBase}) a répondu avec autre chose que du JSON (${snippet || 'réponse vide'}).`);
    }

    try {
      const payload = JSON.parse(raw);

      if (!response.ok) {
        throw new Error(payload.error || fallbackMessage);
      }

      return payload;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Réponse JSON invalide reçue depuis l'API (${apiBase}).`);
      }

      throw error;
    }
  }

  function setStatus(node, message, isError) {
    node.textContent = message || '';
    node.classList.toggle('is-error', Boolean(isError));
  }

  function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('fr-FR');
  }

  function createField(labelText, value, onInput, options = {}) {
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.textContent = labelText;

    const input = options.multiline ? document.createElement('textarea') : document.createElement('input');
    if (!options.multiline) {
      input.type = options.type || 'text';
    }
    input.value = value || '';
    input.addEventListener('input', () => onInput(input.value));

    field.append(label, input);

    if (options.help) {
      const help = document.createElement('small');
      help.textContent = options.help;
      field.appendChild(help);
    }

    return field;
  }

  function createGroup(titleText, descriptionText, isAlt) {
    const group = document.createElement('section');
    group.className = `group${isAlt ? ' alt' : ''}`;

    const header = document.createElement('div');
    header.className = 'groupHeader';

    const title = document.createElement('h3');
    title.textContent = titleText;

    header.appendChild(title);

    if (descriptionText) {
      const description = document.createElement('p');
      description.textContent = descriptionText;
      header.appendChild(description);
    }

    group.appendChild(header);
    return group;
  }

  function createRepeater(items, createItem, onAdd, addLabel) {
    const wrapper = document.createElement('div');
    wrapper.className = 'repeater';

    items.forEach((item, index) => {
      wrapper.appendChild(createItem(item, index));
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'secondary';
    addButton.textContent = addLabel;
    addButton.addEventListener('click', onAdd);

    wrapper.appendChild(addButton);
    return wrapper;
  }

  function createRepeaterItem(titleText, onRemove) {
    const item = document.createElement('article');
    item.className = 'repeaterItem';

    const head = document.createElement('div');
    head.className = 'repeaterItem__head';

    const title = document.createElement('strong');
    title.textContent = titleText;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'danger';
    removeButton.textContent = 'Supprimer';
    removeButton.addEventListener('click', onRemove);

    head.append(title, removeButton);
    item.appendChild(head);

    return item;
  }

  function renderContentEditor() {
    if (!contentState) return;

    contentEditor.innerHTML = '';

    const shared = createGroup('Informations partagées', 'Identité, contact, réservation et pied de page.');
    const sharedGrid = document.createElement('div');
    sharedGrid.className = 'grid two';
    sharedGrid.append(
      createField('Nom affiché', contentState.shared.brandName, (value) => { contentState.shared.brandName = value; }),
      createField('Rôle affiché', contentState.shared.brandRole, (value) => { contentState.shared.brandRole = value; }),
      createField('Libellé du bouton de réservation', contentState.shared.bookingLabel, (value) => { contentState.shared.bookingLabel = value; }),
      createField('URL de réservation', contentState.shared.bookingUrl, (value) => { contentState.shared.bookingUrl = value; }),
      createField('Adresse', contentState.shared.addressText, (value) => { contentState.shared.addressText = value; }),
      createField('URL Google Maps / itinéraire', contentState.shared.mapsUrl, (value) => { contentState.shared.mapsUrl = value; }),
      createField('Email', contentState.shared.email, (value) => { contentState.shared.email = value; }),
      createField('Téléphone affiché', contentState.shared.phoneDisplay, (value) => { contentState.shared.phoneDisplay = value; }),
      createField('Lien téléphone', contentState.shared.phoneHref, (value) => { contentState.shared.phoneHref = value; }, { help: 'Exemple : tel:+33781602221' }),
      createField('Libellé Instagram pied de page', contentState.shared.instagramLabel, (value) => { contentState.shared.instagramLabel = value; }),
      createField('URL Instagram', contentState.shared.instagramUrl, (value) => { contentState.shared.instagramUrl = value; }),
      createField('Nom dans le copyright', contentState.shared.footerCopyName, (value) => { contentState.shared.footerCopyName = value; })
    );
    shared.appendChild(sharedGrid);
    contentEditor.appendChild(shared);

    const homeSeo = createGroup('Accueil - SEO et hero', 'Titres, méta-description et bandeau principal.', true);
    const homeSeoGrid = document.createElement('div');
    homeSeoGrid.className = 'grid two';
    homeSeoGrid.append(
      createField('Title SEO', contentState.home.seo.title, (value) => { contentState.home.seo.title = value; }),
      createField('OG title', contentState.home.seo.ogTitle, (value) => { contentState.home.seo.ogTitle = value; }),
      createField('Description SEO', contentState.home.seo.description, (value) => { contentState.home.seo.description = value; }, { multiline: true }),
      createField('OG description', contentState.home.seo.ogDescription, (value) => { contentState.home.seo.ogDescription = value; }, { multiline: true }),
      createField('Kicker hero', contentState.home.hero.kicker, (value) => { contentState.home.hero.kicker = value; }),
      createField('Titre hero', contentState.home.hero.title, (value) => { contentState.home.hero.title = value; }),
      createField('Texte hero', contentState.home.hero.text, (value) => { contentState.home.hero.text = value; }, { multiline: true }),
      createField('Nom sous le hero', contentState.home.hero.brand, (value) => { contentState.home.hero.brand = value; }),
      createField('Bouton hero', contentState.home.hero.ctaLabel, (value) => { contentState.home.hero.ctaLabel = value; }),
      createField('Lien du bouton hero', contentState.home.hero.ctaUrl, (value) => { contentState.home.hero.ctaUrl = value; }),
      createField('Titre horaires', contentState.home.schedule.title, (value) => { contentState.home.schedule.title = value; }),
      createField('Sous-titre horaires', contentState.home.schedule.subtitle, (value) => { contentState.home.schedule.subtitle = value; }, { multiline: true }),
      createField('Titre liens locaux', contentState.home.localLinksTitle, (value) => { contentState.home.localLinksTitle = value; })
    );
    homeSeo.appendChild(homeSeoGrid);
    contentEditor.appendChild(homeSeo);

    const bodymapGroup = createGroup('Accueil - Zones et motifs', 'Zones interactives du corps et casier “Ou encore”.');
    bodymapGroup.appendChild(
      createField('Titre de la zone', contentState.home.bodymap.title, (value) => { contentState.home.bodymap.title = value; })
    );
    bodymapGroup.appendChild(
      createField('Titre du casier', contentState.home.bodymap.lockerTitle, (value) => { contentState.home.bodymap.lockerTitle = value; })
    );
    bodymapGroup.appendChild(
      createField('Titre par défaut du panneau', contentState.home.bodymap.lockerDefaultTitle, (value) => { contentState.home.bodymap.lockerDefaultTitle = value; })
    );
    bodymapGroup.appendChild(
      createField('Texte par défaut du panneau', contentState.home.bodymap.lockerDefaultText, (value) => { contentState.home.bodymap.lockerDefaultText = value; }, { multiline: true })
    );

    bodymapGroup.appendChild(createRepeater(
      contentState.home.bodymap.hotspots,
      (item, index) => {
        const repeaterItem = createRepeaterItem(`Zone ${index + 1}`, () => {
          contentState.home.bodymap.hotspots.splice(index, 1);
          renderContentEditor();
        });
        const grid = document.createElement('div');
        grid.className = 'grid two';
        grid.append(
          createField('Label bouton', item.label, (value) => { item.label = value; }, { help: 'Utilise un retour à la ligne pour forcer un saut.' }),
          createField('Classe CSS de position', item.className, (value) => { item.className = value; }),
          createField('Titre popup', item.title, (value) => { item.title = value; }),
          createField('Texte popup', item.text, (value) => { item.text = value; }, { multiline: true })
        );
        repeaterItem.appendChild(grid);
        return repeaterItem;
      },
      () => {
        contentState.home.bodymap.hotspots.push({ label: '', title: '', text: '', className: '' });
        renderContentEditor();
      },
      'Ajouter une zone'
    ));

    bodymapGroup.appendChild(createRepeater(
      contentState.home.bodymap.lockerItems,
      (item, index) => {
        const repeaterItem = createRepeaterItem(`Motif ${index + 1}`, () => {
          contentState.home.bodymap.lockerItems.splice(index, 1);
          renderContentEditor();
        });
        const grid = document.createElement('div');
        grid.className = 'grid two';
        grid.append(
          createField('Label bouton', item.label, (value) => { item.label = value; }),
          createField('Titre panneau', item.title, (value) => { item.title = value; }),
          createField('Texte panneau', item.text, (value) => { item.text = value; }, { multiline: true })
        );
        repeaterItem.appendChild(grid);
        return repeaterItem;
      },
      () => {
        contentState.home.bodymap.lockerItems.push({ label: '', title: '', text: '' });
        renderContentEditor();
      },
      'Ajouter un motif'
    ));
    contentEditor.appendChild(bodymapGroup);

    const reviewsGroup = createGroup('Accueil - Avis', 'Titre de section et cartes d’avis.', true);
    reviewsGroup.appendChild(
      createField('Titre des avis', contentState.home.reviews.title, (value) => { contentState.home.reviews.title = value; })
    );
    reviewsGroup.appendChild(createRepeater(
      contentState.home.reviews.items,
      (item, index) => {
        const repeaterItem = createRepeaterItem(`Avis ${index + 1}`, () => {
          contentState.home.reviews.items.splice(index, 1);
          renderContentEditor();
        });
        const grid = document.createElement('div');
        grid.className = 'grid two';
        grid.append(
          createField('Titre de l’avis', item.quote, (value) => { item.quote = value; }),
          createField('Nom', item.name, (value) => { item.name = value; }),
          createField('Texte', item.text, (value) => { item.text = value; }, { multiline: true })
        );
        repeaterItem.appendChild(grid);
        return repeaterItem;
      },
      () => {
        contentState.home.reviews.items.push({ quote: '', text: '', name: '' });
        renderContentEditor();
      },
      'Ajouter un avis'
    ));
    contentEditor.appendChild(reviewsGroup);

    const prestationsGroup = createGroup('Prestations', 'SEO, résumé et liste de services.');
    const prestationsGrid = document.createElement('div');
    prestationsGrid.className = 'grid two';
    prestationsGrid.append(
      createField('Title SEO prestations', contentState.prestations.seo.title, (value) => { contentState.prestations.seo.title = value; }),
      createField('OG title prestations', contentState.prestations.seo.ogTitle, (value) => { contentState.prestations.seo.ogTitle = value; }),
      createField('Description SEO prestations', contentState.prestations.seo.description, (value) => { contentState.prestations.seo.description = value; }, { multiline: true }),
      createField('OG description prestations', contentState.prestations.seo.ogDescription, (value) => { contentState.prestations.seo.ogDescription = value; }, { multiline: true }),
      createField('Titre page prestations', contentState.prestations.title, (value) => { contentState.prestations.title = value; }),
      createField('Étape / sous-titre', contentState.prestations.stepLabel, (value) => { contentState.prestations.stepLabel = value; }),
      createField('Titre du résumé', contentState.prestations.summaryTitle, (value) => { contentState.prestations.summaryTitle = value; }),
      createField('Nom dans le résumé', contentState.prestations.summaryCabinetName, (value) => { contentState.prestations.summaryCabinetName = value; }),
      createField('Sous-texte du résumé', contentState.prestations.summaryCabinetRole, (value) => { contentState.prestations.summaryCabinetRole = value; }),
      createField('Aide sous le bouton', contentState.prestations.summaryHint, (value) => { contentState.prestations.summaryHint = value; }, { multiline: true })
    );
    prestationsGroup.appendChild(prestationsGrid);
    prestationsGroup.appendChild(createRepeater(
      contentState.prestations.services,
      (service, index) => {
        const repeaterItem = createRepeaterItem(`Service ${index + 1}`, () => {
          contentState.prestations.services.splice(index, 1);
          renderContentEditor();
        });
        const grid = document.createElement('div');
        grid.className = 'grid two';
        grid.append(
          createField('Identifiant', service.id, (value) => { service.id = value; }),
          createField('Tarif', service.price, (value) => { service.price = value; }),
          createField('Nom du service', service.name, (value) => { service.name = value; }),
          createField('Lien Doctolib / réservation', service.bookingUrl, (value) => { service.bookingUrl = value; }),
          createField('Sous-texte', service.sub, (value) => { service.sub = value; }, { multiline: true }),
          createField('Détails (une ligne = un point)', service.details.join('\n'), (value) => {
            service.details = value.split('\n').map((item) => item.trim()).filter(Boolean);
          }, { multiline: true })
        );
        repeaterItem.appendChild(grid);
        return repeaterItem;
      },
      () => {
        contentState.prestations.services.push({ id: '', name: '', sub: '', price: '', bookingUrl: '', details: [] });
        renderContentEditor();
      },
      'Ajouter un service'
    ));
    contentEditor.appendChild(prestationsGroup);

    contentMetaNode.textContent = contentState.updatedAt
      ? `Dernière mise à jour enregistrée : ${formatDate(contentState.updatedAt)}`
      : '';
  }

  function renderHoursEditor() {
    if (!hoursState) return;

    scheduleEditor.innerHTML = '';

    hoursState.cabinets.forEach((cabinet, cabinetIndex) => {
      const group = createGroup(cabinet.name || `Cabinet ${cabinetIndex + 1}`, 'Informations du cabinet et créneaux.', cabinetIndex % 2 === 1);

      const cabinetGrid = document.createElement('div');
      cabinetGrid.className = 'grid two';
      cabinetGrid.append(
        createField('Identifiant', cabinet.id, (value) => { cabinet.id = value; }),
        createField('Nom du cabinet', cabinet.name, (value) => { cabinet.name = value; }),
        createField('Adresse', cabinet.address, (value) => { cabinet.address = value; }, { multiline: true }),
        createField('Libellé du bouton', cabinet.ctaLabel, (value) => { cabinet.ctaLabel = value; }),
        createField('Lien du bouton', cabinet.ctaUrl, (value) => { cabinet.ctaUrl = value; })
      );
      group.appendChild(cabinetGrid);

      group.appendChild(createRepeater(
        cabinet.schedules,
        (schedule, scheduleIndex) => {
          const repeaterItem = createRepeaterItem(`Créneau ${scheduleIndex + 1}`, () => {
            cabinet.schedules.splice(scheduleIndex, 1);
            renderHoursEditor();
          });
          const grid = document.createElement('div');
          grid.className = 'grid two';
          grid.append(
            createField('Jour', schedule.day, (value) => { schedule.day = value; }),
            createField('Horaires (une ligne par plage)', schedule.time, (value) => { schedule.time = value; }, { multiline: true })
          );
          repeaterItem.appendChild(grid);
          return repeaterItem;
        },
        () => {
          cabinet.schedules.push({ day: '', time: '' });
          renderHoursEditor();
        },
        'Ajouter un créneau'
      ));

      scheduleEditor.appendChild(group);
    });

    hoursMetaNode.textContent = hoursState.updatedAt
      ? `Dernière mise à jour enregistrée : ${formatDate(hoursState.updatedAt)}`
      : '';
  }

  async function loadContent() {
    const response = await fetch(buildApiUrl('/api/content'), {
      headers: { Accept: 'application/json' }
    });

    contentState = await parseApiJson(response, 'Impossible de charger le contenu.');
    renderContentEditor();
  }

  async function loadHours() {
    const response = await fetch(buildApiUrl('/api/hours'), {
      headers: { Accept: 'application/json' }
    });

    hoursState = await parseApiJson(response, 'Impossible de charger les horaires.');
    renderHoursEditor();
  }

  async function saveContent() {
    setStatus(contentStatusNode, 'Enregistrement du contenu en cours…', false);

    const response = await fetch(buildApiUrl('/api/content'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-admin-password': passwordInput.value
      },
      body: JSON.stringify(contentState)
    });

    const payload = await parseApiJson(response, 'Impossible d’enregistrer le contenu.');

    contentState = payload;
    renderContentEditor();
    setStatus(contentStatusNode, 'Contenu enregistré avec succès.', false);
  }

  async function saveHours() {
    setStatus(hoursStatusNode, 'Enregistrement des horaires en cours…', false);

    const response = await fetch(buildApiUrl('/api/hours'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-admin-password': passwordInput.value
      },
      body: JSON.stringify(hoursState)
    });

    const payload = await parseApiJson(response, 'Impossible d’enregistrer les horaires.');

    hoursState = payload;
    renderHoursEditor();
    setStatus(hoursStatusNode, 'Horaires enregistrés avec succès.', false);
  }

  async function loadAll() {
    setStatus(contentStatusNode, 'Chargement du contenu…', false);
    setStatus(hoursStatusNode, 'Chargement des horaires…', false);

    try {
      await Promise.all([loadContent(), loadHours()]);
      setStatus(contentStatusNode, 'Contenu chargé.', false);
      setStatus(hoursStatusNode, 'Horaires chargés.', false);
    } catch (error) {
      console.error(error);
      if (!contentState) {
        setStatus(contentStatusNode, getFriendlyError(error, 'Impossible de charger le contenu.'), true);
      }
      if (!hoursState) {
        setStatus(hoursStatusNode, getFriendlyError(error, 'Impossible de charger les horaires.'), true);
      }
    }
  }

  async function handleSaveAll() {
    try {
      await saveContent();
      await saveHours();
    } catch (error) {
      console.error(error);
      const message = error.message || 'Impossible d’enregistrer.';
      setStatus(contentStatusNode, message, true);
      setStatus(hoursStatusNode, message, true);
    }
  }

  saveContentButton.addEventListener('click', async () => {
    try {
      await saveContent();
    } catch (error) {
      console.error(error);
      setStatus(contentStatusNode, error.message || 'Impossible d’enregistrer le contenu.', true);
    }
  });

  saveHoursButton.addEventListener('click', async () => {
    try {
      await saveHours();
    } catch (error) {
      console.error(error);
      setStatus(hoursStatusNode, error.message || 'Impossible d’enregistrer les horaires.', true);
    }
  });

  saveAllButton.addEventListener('click', handleSaveAll);

  loadAll();
})();
