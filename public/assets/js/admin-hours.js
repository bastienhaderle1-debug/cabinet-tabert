(function () {
  const editor = document.getElementById('schedule-editor');
  const passwordInput = document.getElementById('admin-password');
  const saveButton = document.getElementById('save-button');
  const statusNode = document.getElementById('status');
  const metaNode = document.getElementById('meta');

  let state = null;

  function setStatus(message, isError) {
    statusNode.textContent = message || '';
    statusNode.classList.toggle('is-error', Boolean(isError));
  }

  function createSlotRow(cabinetIndex, schedule = { day: '', time: '' }) {
    const row = document.createElement('div');
    row.className = 'slot';
    const dayInput = document.createElement('input');
    dayInput.type = 'text';
    dayInput.placeholder = 'Jour';
    dayInput.value = schedule.day || '';
    dayInput.dataset.field = 'day';

    const timeInput = document.createElement('textarea');
    timeInput.placeholder = 'Horaires, une ligne par plage';
    timeInput.value = schedule.time || '';
    timeInput.dataset.field = 'time';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'danger';
    removeButton.dataset.action = 'remove-slot';
    removeButton.textContent = 'Supprimer';

    row.append(dayInput, timeInput, removeButton);

    removeButton.addEventListener('click', () => {
      state.cabinets[cabinetIndex].schedules = state.cabinets[cabinetIndex].schedules.filter((_, index) => index !== [...row.parentNode.children].indexOf(row));
      render();
    });

    [dayInput, timeInput].forEach((field) => {
      field.addEventListener('input', () => {
        const slotIndex = [...row.parentNode.children].indexOf(row);
        state.cabinets[cabinetIndex].schedules[slotIndex][field.dataset.field] = field.value;
      });
    });

    return row;
  }

  function render() {
    if (!state) return;

    editor.innerHTML = '';

    state.cabinets.forEach((cabinet, cabinetIndex) => {
      const panel = document.createElement('section');
      panel.className = 'cabinet';

      const title = document.createElement('h2');
      title.textContent = cabinet.name;

      const address = document.createElement('p');
      address.className = 'meta';
      address.textContent = cabinet.address;

      const slotList = document.createElement('div');
      slotList.className = 'slot-list';

      cabinet.schedules.forEach((schedule) => {
        slotList.appendChild(createSlotRow(cabinetIndex, schedule));
      });

      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'secondary';
      addButton.textContent = 'Ajouter un créneau';
      addButton.addEventListener('click', () => {
        cabinet.schedules.push({ day: '', time: '' });
        render();
      });

      panel.append(title, address, slotList, addButton);
      editor.appendChild(panel);
    });

    if (state.updatedAt) {
      const formatted = new Date(state.updatedAt).toLocaleString('fr-FR');
      metaNode.textContent = `Dernière mise à jour enregistrée : ${formatted}`;
    }
  }

  async function loadHours() {
    setStatus('Chargement des horaires…', false);

    try {
      const response = await fetch('/api/hours', {
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Impossible de charger les horaires.');
      }

      state = await response.json();
      render();
      setStatus('Horaires chargés.', false);
    } catch (error) {
      console.error(error);
      setStatus('Impossible de charger les horaires.', true);
    }
  }

  async function saveHours() {
    setStatus('Enregistrement en cours…', false);

    try {
      const response = await fetch('/api/hours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-admin-password': passwordInput.value
        },
        body: JSON.stringify(state)
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Impossible d’enregistrer.');
      }

      state = payload;
      render();
      setStatus('Horaires enregistrés avec succès.', false);
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Impossible d’enregistrer les horaires.', true);
    }
  }

  saveButton.addEventListener('click', saveHours);
  loadHours();
})();
