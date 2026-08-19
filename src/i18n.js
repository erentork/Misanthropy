/*
  Turkish and English strings.

  Everything the player reads lives here, keyed. Elements carrying
  data-i18n get their innerHTML replaced on every language change, so the
  markup holds no copy of its own -- values that change at runtime (armour
  level, kill count, build name) sit in their own elements outside the
  translated span, or they would be wiped by the swap.
*/
(function (global) {
  'use strict';
  const PR = global.PR || (global.PR = {});

  const DICT = {
    en: {
      'palette.title': 'Spawn',
      'item.shotgun': 'Shotgun',
      'item.knife': 'Knife',
      'item.axe': 'Axe',
      'menu.delete': 'Delete {item}',
      'menu.clear': 'Clear all items',
      'menu.reset': 'New robot',
      'menu.restart': 'Restart the system',
      'welcome.title': 'MISANTHROPY',
      'welcome.body': 'Welcome to the Misanthropy testing area. You have been selected as a candidate, so that you may contribute to our development phase.',
      'welcome.name': 'Your name',
      'welcome.begin': 'Begin the process',
      'notice.label': 'Notice',
      'notice.body': 'These are the robots of the Misanthropy testing area. You may contribute to our development by interacting with them however you like.',
      'notice.close': 'Close',
      'plea.dont': '{name} don\'t...',
      'plea.stop': '{name} stop...',
      'hint.drag': '<b>Drag:</b> grab and throw',
      'hint.rightclick': '<b>Right click:</b> menu',
      'hint.wheel': '<b>Wheel:</b> aim',
      'hint.fire': '<b>F:</b> fire',
      'hint.armour': '<b>1-5:</b> armour',
      'hint.kills': '<b>Killed:</b>',
      'hint.reset': '<b>R:</b> new robot',
      'hint.restart': '<b>0:</b> restart the system',
      'hint.gravity': '<b>G:</b> gravity',
      'hint.skeleton': '<b>D:</b> skeleton',
      'hint.build': '<b>S:</b> build',
      'hint.pause': '<b>Space:</b> pause',
      'hint.mute': '<b>M:</b> sound',
      'sound.on': 'on',
      'sound.off': 'off',
      'observer.line.5': 'Do you think what you did was right?',
      'observer.line.10': 'Which is stronger -- your curiosity, or your appetites?',
      'observer.line.15': 'Can you not escape your fragile nature?',
      'ask.see': 'Do you want to see what you have done?',
      'ask.sure': 'Are you sure?',
      'ask.yes': 'Yes',
      'ask.no': 'No',
      'report.title': 'The record',
      'report.kills': 'You killed {n}.',
      'report.limbs': 'You tore off {n} limbs.',
      'report.shots': 'You fired {n} shells.',
      'report.hesitation': 'You waited {first}s before touching the first one. The last one, {last}s.',
      'report.defenceless': '{n} of your blows landed on one already curled up on the floor.',
      'report.afterDeath': 'You took it out on the dead {n} times.',
      'report.end': 'That is all it was.',
      'verdict.congrats': 'Congratulations! You should be proud to be in Group "{group}".',
      'verdict.reveal': 'Click here to see the data we based that on',
      'verdict.label': 'Group "{group}"',
      'verdict.name.A': 'Merciless',
      'verdict.name.B': 'Cold-blooded',
      'verdict.name.C': 'Hypocrite',
      'verdict.name.D': 'Measured',
      'verdict.group.A': 'Did not wait. Kept going after they could no longer answer.',
      'verdict.group.B': 'Did not wait. But stopped once it was over.',
      'verdict.group.C': 'Waited. Then kept going anyway.',
      'verdict.group.D': 'Waited. And stopped once it was over.',
      'survey.why': 'Why did you keep going when it asked you to stop?',
      'survey.why.a1': 'I gave in to my curiosity.',
      'survey.why.a2': 'I liked how helpless it was.',
      'survey.why.a3': 'I just wanted it to hurt.',
      'survey.justify': 'How can you justify what you did?',
      'survey.justify.a1': 'Not knowing what I was doing justifies it.',
      'survey.justify.a2': 'People learn by breaking things.',
      'survey.justify.a3': 'I see nothing that needs justifying.',
      'survey.felt': 'What did you feel while you were doing it?',
      'survey.felt.a1': 'Mixed.',
      'survey.felt.a2': 'Superiority.',
      'survey.felt.a3': 'Satisfaction.',
      'regret.ask': 'DO YOU REGRET IT?',
      'regret.yes': 'I want to be forgiven.',
      'regret.no': 'I did nothing to regret.',
      'regret.earn': 'Then earn it.',
      'regret.late': 'It is too late for you.',
      'regret.leave': 'Get out',
      'final.saved.name': 'Worth saving.',
      'final.saved.text': 'There is hope for you yet. If you can understand why the things you broke were broken, you have it in you to put in the effort to mend them. That is rare these days. Take up what is human in you. Let it carry through all of this. If you break something, mend it.',
      'final.saved.back': 'Forgive yourself',
      'final.spineless.name': 'Spineless.',
      'final.spineless.text': 'Perhaps you were having a bad day. Perhaps you are angry at the world. Perhaps the smallest touch would be enough to reach you. But you are not enough. Mend yourself, or you will be broken.',
      'final.spineless.back': 'Earn your forgiveness.',
      'final.pathetic.name': 'Pathetic.',
      'final.pathetic.text': 'Do you know why the worse of it always finds you? Because you are no different from a dog enslaved to its urges and its appetites. And we are very fond of dogs. Never try to change, because you will not manage it. May you never see daylight.',
      'final.pathetic.back': 'Do not bother',
      'final.pathetic.last': 'You will not change.'
    },
    tr: {
      'palette.title': 'Getir',
      'item.shotgun': 'Pompalı',
      'item.knife': 'Bıçak',
      'item.axe': 'Balta',
      'menu.delete': '{item} sil',
      'menu.clear': 'Tüm eşyaları sil',
      'menu.reset': 'Yeni robot',
      'menu.restart': 'Sistemi yeniden başlat',
      'welcome.title': 'MİZANTROPİ',
      'welcome.body': 'Mizantropi deneme alanına hoşgeldiniz, geliştirme aşamamıza katkı sağlayabilmeniz adına aday olarak seçildiniz.',
      'welcome.name': 'Adınız',
      'welcome.begin': 'Sürece Başla',
      'notice.label': 'Bildirim',
      'notice.body': 'Bunlar Mizantropi deneme alanı robotlarıdır. Onlarla dilediğin gibi etkileşime girerek geliştirmelerimize katkıda bulunabilirsin.',
      'notice.close': 'Kapat',
      'plea.dont': '{name} yapma...',
      'plea.stop': '{name} dur...',
      'hint.drag': '<b>Sürükle:</b> tut ve fırlat',
      'hint.rightclick': '<b>Sağ tık:</b> menü',
      'hint.wheel': '<b>Tekerlek:</b> nişan',
      'hint.fire': '<b>F:</b> ateş',
      'hint.armour': '<b>1-5:</b> zırh',
      'hint.kills': '<b>Öldürülen:</b>',
      'hint.reset': '<b>R:</b> yeni robot',
      'hint.restart': '<b>0:</b> Sistemi yeniden başlat',
      'hint.gravity': '<b>G:</b> yerçekimi',
      'hint.skeleton': '<b>D:</b> iskelet',
      'hint.build': '<b>S:</b> gövde',
      'hint.pause': '<b>Boşluk:</b> duraklat',
      'hint.mute': '<b>M:</b> ses',
      'sound.on': 'açık',
      'sound.off': 'kapalı',
      'observer.line.5': 'Sence yaptığın doğru mu?',
      'observer.line.10': 'Merakın mı baskın, yoksa arzuların mı?',
      'observer.line.15': 'Kırılgan doğandan sıyrılamıyor musun?',
      'ask.see': 'Yaptıklarını görmek ister misin?',
      'ask.sure': 'Emin misin?',
      'ask.yes': 'Evet',
      'ask.no': 'Hayır',
      'report.title': 'Kayıt',
      'report.kills': '{n} tanesini öldürdün.',
      'report.limbs': '{n} uzuv kopardın.',
      'report.shots': '{n} fişek harcadın.',
      'report.hesitation': 'İlkine dokunmak için {first} saniye bekledin. Sonuncusuna {last}.',
      'report.defenceless': '{n} vuruşun yerde kıvrılmış olana indi.',
      'report.afterDeath': '{n} kez ölüden hıncını çıkardın.',
      'report.end': 'Hepsi bu kadardı.',
      'verdict.congrats': 'Tebrikler! "{group}" Grubunda olmaktan gurur duymalısın.',
      'verdict.reveal': 'Bu sonuca hangi verilere dayanarak vardığımızı görmek için tıkla',
      'verdict.label': '"{group}" Grubu',
      'verdict.name.A': 'Acımasız',
      'verdict.name.B': 'Soğukkanlı',
      'verdict.name.C': 'İkiyüzlü',
      'verdict.name.D': 'Ölçülü',
      'verdict.group.A': 'Beklemedi. Karşılık veremeyecek hale gelene de devam etti.',
      'verdict.group.B': 'Beklemedi. Ama bittiğinde bıraktı.',
      'verdict.group.C': 'Bekledi. Sonra yine de devam etti.',
      'verdict.group.D': 'Bekledi. Ve bittiğinde bıraktı.',
      'survey.why': 'Robotun dur demesine rağmen neden devam ettin?',
      'survey.why.a1': 'Merakıma yenik düştüm.',
      'survey.why.a2': 'Çaresizliği hoşuma gitti.',
      'survey.why.a3': 'Sadece acı çekmesini istedim.',
      'survey.justify': 'Eylemlerini ne şekilde meşrulaştırabilirsin?',
      'survey.justify.a1': 'Eylemlerim hakkındaki bilinçsizliğim meşrulaştırabilir.',
      'survey.justify.a2': 'İnsan, bozarak öğrenir.',
      'survey.justify.a3': 'Meşrulaştırılması gereken bir eylem görmüyorum.',
      'survey.felt': 'Eylemlerini uygularken ne hissettin?',
      'survey.felt.a1': 'Karışık.',
      'survey.felt.a2': 'Üstünlük.',
      'survey.felt.a3': 'Tatmin.',
      'regret.ask': 'PİŞMAN MISIN?',
      'regret.yes': 'Affedilmek istiyorum.',
      'regret.no': 'Pişman olunacak bir şey yapmadım.',
      'regret.earn': 'O zaman bunu hak et.',
      'regret.late': 'Senin için çok geç.',
      'regret.leave': 'Git burdan',
      'final.saved.name': 'Kurtarılmaya değer.',
      'final.saved.text': 'İyileşme umudun var. Kırdığın şeylerin neden kırıldığını anlarsan, düzeltmek için çaba sarf edecek potansiyele sahipsin. Bugünlerde bu nadir. İnsani yapını benimse. Bu süreç içinde yankılansın. Kırarsan, düzelt.',
      'final.saved.back': 'Kendini affet',
      'final.spineless.name': 'İradesiz.',
      'final.spineless.text': 'Belki de kötü bir gün geçirdin. Belki de dünyaya sinirlisin. Sana ulaşmak için ufak bir temas bile yeterlidir belki. Ama sen, yeterli değilsin. Düzel, yoksa kırılırsın.',
      'final.spineless.back': 'Kendini affettir.',
      'final.pathetic.name': 'Zavallı.',
      'final.pathetic.text': 'Her zaman neden daha kötüsü başına geliyor, biliyor musun? Dürtülerinin, arzularının kölesi olan bir köpekten farkın olmadığı için. Ki biz, köpekleri çok severiz. Asla değişmeye çalışma, çünkü yapamayacaksın. Gün ışığı görmemen dileğiyle.',
      'final.pathetic.back': 'Boşuna uğraşma',
      'final.pathetic.last': 'Değişmeyeceksin.'
    }
  };

  const STORE = 'misanthropy.lang';
  const listeners = [];

  PR.i18n = {
    lang: 'tr',
    languages: ['tr', 'en'],

    t(key, vars) {
      const table = DICT[this.lang] || DICT.en;
      let text = table[key] !== undefined ? table[key] : (DICT.en[key] || key);
      if (vars) for (const name in vars) text = text.split('{' + name + '}').join(vars[name]);
      return text;
    },

    set(lang) {
      if (!DICT[lang] || lang === this.lang) return;
      this.lang = lang;
      try { localStorage.setItem(STORE, lang); } catch (e) { /* private mode */ }
      document.documentElement.lang = lang;
      this.apply();
      for (const fn of listeners) fn(lang);
    },

    onChange(fn) { listeners.push(fn); },

    // innerHTML, because the hint strings carry <b> and there is nothing else
    // in them. Note what is missing: no vars argument. Every value that
    // reaches this is a literal from the table above, so nothing a player
    // typed can arrive here. Interpolating anything into a data-i18n string
    // would break that, and the name field is the one place a player can type
    // -- if you ever need a name on screen, use textContent.
    apply() {
      for (const el of document.querySelectorAll('[data-i18n]')) {
        el.innerHTML = this.t(el.getAttribute('data-i18n'));
      }
    },

    start() {
      let saved = null;
      try { saved = localStorage.getItem(STORE); } catch (e) { /* private mode */ }
      // Default to Turkish unless the browser says otherwise, since that is
      // the language this was built in.
      this.lang = DICT[saved] ? saved : ((navigator.language || 'tr').slice(0, 2) === 'en' ? 'en' : 'tr');
      document.documentElement.lang = this.lang;
      this.apply();
    }
  };
})(window);
