// 示例询盘（虚构）。人名、公司、邮箱、电话均为编造，邮箱使用保留域名 .example。

export const SAMPLE_INQUIRIES = [
  {
    id: 'Q-1009-01',
    source: '阿里国际站',
    receivedAt: '2026-10-09T02:14:00+08:00',
    city: 'Hamburg',
    status: 'open',
    text: `Hello,

We are a housewares importer in Germany. Please quote 5,000 pcs of your 500ml double wall vacuum flask (VF-500), with our logo printed in one color, packed in individual color gift box.
Price FOB Shanghai please, goods will be shipped to Hamburg.
Can you also tell me the lead time?

Best regards,
Jonas Weber
Weber Haushaltswaren GmbH
jonas.weber@weber-hw.example
+49 40 5550 1234`,
  },
  {
    id: 'Q-1009-02',
    source: '独立站表单',
    receivedAt: '2026-10-09T04:37:00+08:00',
    city: 'Lyon',
    status: 'open',
    text: `Bonjour,

Nous sommes une boutique d'articles de cuisine à Lyon. Nous cherchons une bouteille isotherme de 750 ml avec notre logo gravé au laser.
Pourriez-vous nous envoyer votre meilleur prix CIF Le Havre, en euros ?
Merci de nous indiquer aussi si vous avez le certificat LFGB.

Cordialement,
Claire Martin
Atelier Martin SARL
claire.martin@atelier-martin.example`,
  },
  {
    id: 'Q-1009-03',
    source: '企业邮箱',
    receivedAt: '2026-10-09T06:05:00+08:00',
    city: 'Chicago',
    status: 'open',
    text: `Hi,

We are planning our holiday program. Please quote 20,000 pcs of the 600ml travel coffee tumbler, two color logo printing, white box packing, CIF Los Angeles.
We need the FDA food contact test report for our compliance team.

Thanks,
Mark Davis
Northline Supply LLC
mark@northline.example`,
  },
  {
    id: 'Q-1009-04',
    source: '企业邮箱',
    receivedAt: '2026-10-09T08:50:00+08:00',
    city: 'Rotterdam',
    status: 'open',
    text: `Guten Tag,

wir sind ein Onlinehändler aus den Niederlanden. Bitte senden Sie uns ein Angebot für 2.000 Stück Thermosflasche 750 ml, einfarbig bedruckt, FOB Ningbo.
Haben Sie ein BSCI-Audit? Das ist für unseren Kunden Pflicht.

Mit freundlichen Grüßen
Sanne de Vries
Bolt Huishouden B.V.`,
  },
  {
    id: 'Q-1008-07',
    source: '企业邮箱',
    receivedAt: '2026-10-08T17:22:00+08:00',
    city: 'Madrid',
    status: 'sent',
    text: `Hola,

Somos distribuidores de vuestros termos en Madrid. Necesitamos 3.000 unidades de tapas de repuesto para la serie VF, precio EXW.
¿Cuál es el plazo de entrega?

Saludos,
Lucía Gómez
Hogar Gómez S.L.
+34 91 555 0199`,
  },
];
