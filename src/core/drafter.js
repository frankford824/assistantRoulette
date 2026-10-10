// 回复初稿：按买家语言拼装。价格一律取自报价结果，模板里不写任何数字。
import { formatInt, formatPrice } from './text.js';

export const LANG_LABEL = { en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch' };

const T = {
  en: {
    greet: (n) => (n ? `Dear ${n},` : 'Dear Sir or Madam,'),
    thanks: 'Thank you for your inquiry.',
    quote: (q) => `For ${q.qty} pcs of our ${q.product} (${q.sku}), our price is ${q.price}/pc ${q.terms}${q.incl}.`,
    incl: (items) => (items.length ? `, including ${items.join(' and ')}` : ''),
    items: { silk1: 'one-color logo printing', silk2: 'two-color logo printing', laser: 'a laser-engraved logo', white: 'an individual white box', color: 'a color gift box' },
    moq: (m) => `Please note our MOQ for this item is ${m} pcs, so the price above is based on ${m} pcs.`,
    validity: (d) => `The quote is valid for ${d} days.`,
    leadArtwork: (d) => `Lead time is ${d} days after sample and artwork approval.`,
    leadOrder: (d) => `Lead time is ${d} days after order confirmation.`,
    certHeld: (l) => `We can provide our ${l} test report${l.includes(' and ') ? 's' : ''} on request.`,
    certPending: (l) => `Regarding ${l}, our sales manager will reply to you separately.`,
    tierIntro: (q) => `To give you an exact price, we need the order quantity. For your reference, our current prices for the ${q.product} (${q.sku})${q.incl}, ${q.terms}, are:`,
    rangeClosed: (a, b) => `${a}–${b} pcs`,
    rangeOpen: (a) => `${a} pcs and above`,
    tierRow: (r, p) => `- ${r}: ${p}/pc`,
    askOne: (q) => `Could you please confirm ${q}?`,
    askMany: 'Could you please confirm the following?',
    q: {
      quantity: 'the order quantity',
      product: 'which item you are interested in (model number or capacity)',
      port: 'the destination port',
      logo_detail: 'the logo printing method and number of colors (we have quoted one-color silk printing for now)',
      logo_artwork: 'the logo color and artwork',
    },
    noProduct: (l) => `We could not identify the exact item from your message. Our main items are: ${l}.`,
    manual: (i) => `For ${i} terms, our sales manager will prepare the quotation and get back to you shortly.`,
    and: ' and ',
    closing: 'Best regards,',
    footer: 'This reply was prepared with AI assistance and reviewed by our sales team.',
  },
  fr: {
    greet: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
    thanks: 'Merci pour votre demande.',
    quote: (q) => `Pour ${q.qty} pièces de l'article ${q.sku} (${q.product}), notre prix est de ${q.price} la pièce, ${q.terms}${q.incl}.`,
    incl: (items) => (items.length ? `, comprenant ${items.join(' et ')}` : ''),
    items: { silk1: "l'impression du logo en une couleur", silk2: "l'impression du logo en deux couleurs", laser: 'la gravure laser du logo', white: 'une boîte blanche individuelle', color: 'une boîte cadeau couleur individuelle' },
    moq: (m) => `Notre quantité minimum de commande pour cet article est de ${m} pièces ; le prix ci-dessus est calculé sur cette base.`,
    validity: (d) => `Cette offre est valable ${d} jours.`,
    leadArtwork: (d) => `Le délai de production est de ${d} jours après validation de l'échantillon et du logo.`,
    leadOrder: (d) => `Le délai de production est de ${d} jours après confirmation de la commande.`,
    certHeld: (l) => `Nous pouvons vous transmettre notre rapport d'essai ${l} sur demande.`,
    certPending: (l) => `Concernant ${l}, notre responsable commercial reviendra vers vous séparément.`,
    tierIntro: (q) => `Pour vous donner un prix exact, nous avons besoin de la quantité. À titre indicatif, voici nos prix actuels pour l'article ${q.sku} (${q.product})${q.incl}, ${q.terms} :`,
    rangeClosed: (a, b) => `${a}–${b} pièces`,
    rangeOpen: (a) => `${a} pièces et plus`,
    tierRow: (r, p) => `- ${r} : ${p} la pièce`,
    askOne: (q) => `Pourriez-vous nous préciser ${q} ?`,
    askMany: 'Pourriez-vous nous préciser les points suivants ?',
    q: {
      quantity: 'la quantité souhaitée',
      product: "l'article qui vous intéresse (référence ou contenance)",
      port: 'le port de destination',
      logo_detail: 'la technique de marquage et le nombre de couleurs du logo (nous avons chiffré une impression une couleur)',
      logo_artwork: 'la couleur du logo et le fichier du logo',
    },
    noProduct: (l) => `Nous n'avons pas pu identifier l'article exact. Nos principaux produits sont : ${l}.`,
    manual: (i) => `Pour les conditions ${i}, notre responsable commercial préparera l'offre et reviendra vers vous rapidement.`,
    and: ' et ',
    closing: 'Cordialement,',
    footer: "Cette réponse a été préparée avec l'aide de l'IA et vérifiée par notre équipe commerciale.",
  },
  es: {
    greet: (n) => (n ? `Hola, ${n}:` : 'Hola:'),
    thanks: 'Gracias por su consulta.',
    quote: (q) => `Para ${q.qty} unidades del artículo ${q.sku} (${q.product}), nuestro precio es de ${q.price} por unidad, ${q.terms}${q.incl}.`,
    incl: (items) => (items.length ? `, incluyendo ${items.join(' y ')}` : ''),
    items: { silk1: 'impresión del logo a una tinta', silk2: 'impresión del logo a dos tintas', laser: 'grabado láser del logo', white: 'caja blanca individual', color: 'caja de regalo a color individual' },
    moq: (m) => `El pedido mínimo de este artículo es de ${m} unidades; el precio anterior se basa en esa cantidad.`,
    validity: (d) => `La oferta es válida durante ${d} días.`,
    leadArtwork: (d) => `El plazo de entrega es de ${d} días tras la aprobación de la muestra y del logo.`,
    leadOrder: (d) => `El plazo de entrega es de ${d} días tras la confirmación del pedido.`,
    certHeld: (l) => `Podemos enviarle nuestro informe de ensayo ${l} si lo necesita.`,
    certPending: (l) => `En cuanto a ${l}, nuestro responsable comercial le responderá por separado.`,
    tierIntro: (q) => `Para darle un precio exacto necesitamos la cantidad. Como referencia, nuestros precios actuales del artículo ${q.sku} (${q.product})${q.incl}, ${q.terms}, son:`,
    rangeClosed: (a, b) => `${a}–${b} unidades`,
    rangeOpen: (a) => `${a} unidades o más`,
    tierRow: (r, p) => `- ${r}: ${p} por unidad`,
    askOne: (q) => `¿Podría confirmarnos ${q}?`,
    askMany: '¿Podría confirmarnos lo siguiente?',
    q: {
      quantity: 'la cantidad del pedido',
      product: 'qué artículo le interesa (referencia o capacidad)',
      port: 'el puerto de destino',
      logo_detail: 'la técnica de marcaje y el número de colores del logo (hemos cotizado impresión a una tinta)',
      logo_artwork: 'el color del logo y el archivo del diseño',
    },
    noProduct: (l) => `No hemos podido identificar el artículo exacto. Nuestros productos principales son: ${l}.`,
    manual: (i) => `Para condiciones ${i}, nuestro responsable comercial preparará la oferta y le responderá en breve.`,
    and: ' y ',
    closing: 'Saludos cordiales,',
    footer: 'Esta respuesta se ha preparado con ayuda de IA y ha sido revisada por nuestro equipo comercial.',
  },
  de: {
    greet: (n) => (n ? `Guten Tag ${n},` : 'Sehr geehrte Damen und Herren,'),
    thanks: 'vielen Dank für Ihre Anfrage.',
    quote: (q) => `Für ${q.qty} Stück des Artikels ${q.sku} (${q.product}) beträgt unser Preis ${q.price} pro Stück, ${q.terms}${q.incl}.`,
    incl: (items) => (items.length ? `, inklusive ${items.join(' und ')}` : ''),
    items: { silk1: 'einfarbigem Logodruck', silk2: 'zweifarbigem Logodruck', laser: 'Logo-Lasergravur', white: 'weißer Einzelverpackung', color: 'farbiger Geschenkbox' },
    moq: (m) => `Die Mindestbestellmenge für diesen Artikel beträgt ${m} Stück; der obige Preis basiert auf dieser Menge.`,
    validity: (d) => `Das Angebot ist ${d} Tage gültig.`,
    leadArtwork: (d) => `Die Lieferzeit beträgt ${d} Tage nach Freigabe von Muster und Logo.`,
    leadOrder: (d) => `Die Lieferzeit beträgt ${d} Tage nach Auftragsbestätigung.`,
    certHeld: (l) => `Prüfberichte zu ${l} senden wir Ihnen gerne auf Anfrage zu.`,
    certPending: (l) => `Zu ${l} meldet sich unser Vertriebsleiter separat bei Ihnen.`,
    tierIntro: (q) => `Für einen genauen Preis benötigen wir die Bestellmenge. Zur Orientierung unsere aktuellen Preise für Artikel ${q.sku} (${q.product})${q.incl}, ${q.terms}:`,
    rangeClosed: (a, b) => `${a}–${b} Stück`,
    rangeOpen: (a) => `ab ${a} Stück`,
    tierRow: (r, p) => `- ${r}: ${p} pro Stück`,
    askOne: (q) => `Könnten Sie uns bitte ${q} mitteilen?`,
    askMany: 'Könnten Sie uns bitte Folgendes mitteilen?',
    q: {
      quantity: 'die Bestellmenge',
      product: 'den gewünschten Artikel (Artikelnummer oder Füllmenge)',
      port: 'den Zielhafen',
      logo_detail: 'das Druckverfahren und die Anzahl der Logofarben (kalkuliert ist vorerst einfarbiger Siebdruck)',
      logo_artwork: 'die Logofarbe und die Druckdatei',
    },
    noProduct: (l) => `Den genauen Artikel konnten wir Ihrer Nachricht nicht entnehmen. Unsere Hauptartikel sind: ${l}.`,
    manual: (i) => `Für ${i}-Konditionen erstellt unser Vertriebsleiter das Angebot und meldet sich in Kürze.`,
    and: ' und ',
    closing: 'Mit freundlichen Grüßen',
    footer: 'Diese Antwort wurde mit KI-Unterstützung erstellt und von unserem Vertriebsteam geprüft.',
  },
};

export function aiFooterText(lang) {
  return `--\n${(T[lang] || T.en).footer}`;
}

export function leadTimeFor(product, rules) {
  return (product?.leadTimeDays || rules.leadTimeDays).replace('-', '–');
}

function joinList(list, t) {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')}${t.and}${list[list.length - 1]}`;
}

export function buildQuestions(fields, product, missing) {
  const qs = [...missing];
  if (product?.allowLogo && ['silk1', 'silk2', 'laser'].includes(fields.logo)) qs.push('logo_artwork');
  return qs;
}

export function buildDraft({ fields, product, quote, questions, company, products, rules, settings }) {
  const lang = T[fields.language] ? fields.language : 'en';
  const t = T[lang];
  const paras = [];
  const head = [t.thanks];
  const extra = [];

  if (quote.ok) {
    const items = [];
    if (quote.logoKey !== 'none') items.push(t.items[quote.logoKey]);
    if (quote.packagingKey !== 'none') items.push(t.items[quote.packagingKey]);
    head.push(
      t.quote({
        qty: formatInt(quote.pricedQty, lang),
        product: product.names[lang],
        sku: product.sku,
        price: formatPrice(quote.unit, quote.currency, lang),
        terms: `${quote.incoterm} ${quote.place}`,
        incl: t.incl(items),
      }),
    );
    if (quote.moqApplied) head.push(t.moq(formatInt(quote.moq, lang)));
    head.push(t.validity(rules.quoteValidityDays));
    paras.push(head.join('\n'));
  } else if (quote.reason === 'no_quantity') {
    const items = [];
    const logoKey = product.allowLogo ? (fields.logo === 'unspecified' ? 'silk1' : fields.logo) : 'none';
    if (logoKey && logoKey !== 'none') items.push(t.items[logoKey]);
    if (product.allowPackaging && fields.packaging && fields.packaging !== 'none') items.push(t.items[fields.packaging]);
    head.push(t.tierIntro({ product: product.names[lang], sku: product.sku, incl: t.incl(items), terms: `${quote.incoterm} ${quote.place}` }));
    const rows = quote.tierTable.map((r) => {
      const range = r.max == null ? t.rangeOpen(formatInt(r.min, lang)) : t.rangeClosed(formatInt(r.min, lang), formatInt(r.max, lang));
      return t.tierRow(range, formatPrice(r.unit, r.currency, lang));
    });
    paras.push(head.join('\n'), rows.join('\n'));
  } else {
    if (quote.reason === 'no_product') head.push(t.noProduct(joinList(products.map((p) => `${p.names[lang]} (${p.sku})`), t)));
    if (quote.reason === 'incoterm') head.push(t.manual(quote.incoterm));
    paras.push(head.join('\n'));
  }

  if (fields.leadTimeAsked && product) {
    const days = leadTimeFor(product, rules);
    const withLogo = quote.ok ? quote.logoKey !== 'none' : product.allowLogo && fields.logo && fields.logo !== 'none';
    extra.push(withLogo ? t.leadArtwork(days) : t.leadOrder(days));
  }
  const certs = fields.certsRequested || [];
  const held = certs.filter((c) => company.certsHeld.includes(c));
  const pending = certs.filter((c) => !company.certsHeld.includes(c));
  if (held.length) extra.push(t.certHeld(joinList(held, t)));
  if (pending.length) extra.push(t.certPending(joinList(pending, t)));
  if (extra.length) paras.push(extra.join('\n'));

  if (questions.length === 1) paras.push(t.askOne(t.q[questions[0]]));
  else if (questions.length > 1) paras.push([t.askMany, ...questions.map((k) => `- ${t.q[k]}`)].join('\n'));

  paras.push(`${t.closing}\n${settings.signature}`);
  if (settings.aiFooter) paras.push(aiFooterText(lang));

  return { lang, text: [t.greet(fields.buyerName), ...paras].join('\n\n') };
}
