/*
  The chrome: spawn palette, right-click menu, language switch.

  All plain DOM over the canvas. A 480x270 pixel grid has no room for
  readable text, and menus are chrome rather than part of the scene.
*/
(function (global) {
  'use strict';
  const PR = global.PR;

  PR.setupUi = function (controller) {
    const palette = document.getElementById('palette');
    const menu = document.getElementById('menu');
    const langBox = document.getElementById('lang');

    for (const kind in PR.ITEMS) {
      const button = document.createElement('button');
      button.dataset.kind = kind;
      button.textContent = PR.i18n.t(PR.ITEMS[kind].labelKey);
      button.addEventListener('click', () => controller.spawn(kind));
      palette.appendChild(button);
    }

    for (const lang of PR.i18n.languages) {
      const button = document.createElement('button');
      button.dataset.lang = lang;
      button.textContent = lang.toUpperCase();
      button.addEventListener('click', () => PR.i18n.set(lang));
      langBox.appendChild(button);
    }

    function markLanguage() {
      for (const button of langBox.children)
        button.classList.toggle('on', button.dataset.lang === PR.i18n.lang);
    }

    function relabel() {
      for (const button of palette.querySelectorAll('button[data-kind]'))
        button.textContent = PR.i18n.t(PR.ITEMS[button.dataset.kind].labelKey);
      markLanguage();
      close();   // an open menu holds strings in the old language
    }

    function close() {
      menu.hidden = true;
      menu.textContent = '';
    }

    // Capture phase, so a click anywhere else closes the menu before that
    // click does anything else -- but not a click on the menu itself.
    document.addEventListener('pointerdown', (e) => {
      if (!menu.hidden && !menu.contains(e.target)) close();
    }, true);

    PR.i18n.onChange(relabel);
    markLanguage();

    return {
      close,
      open(clientX, clientY, item) {
        menu.textContent = '';
        const add = (label, action) => {
          const button = document.createElement('button');
          button.textContent = label;
          button.addEventListener('click', () => { action(); close(); });
          menu.appendChild(button);
        };
        if (item) {
          add(PR.i18n.t('menu.delete', { item: PR.i18n.t(PR.ITEMS[item.kind].labelKey) }),
            () => controller.remove(item));
        }
        add(PR.i18n.t('menu.clear'), () => controller.clearItems());
        add(PR.i18n.t('menu.reset'), () => controller.reset());
        add(PR.i18n.t('menu.restart'), () => controller.restart());
        menu.style.left = clientX + 'px';
        menu.style.top = clientY + 'px';
        menu.hidden = false;
      }
    };
  };
})(window);
