import { stacked } from '../../types';
/** Home › Number */
export const numberGroup = stacked('Number', [
  [
    {
      l: 'Number format',
      text: 'General',
      menu: [
        { l: 'General', i: 'G', c: 'fmt.general' },
        { l: 'Number', i: '#,', c: 'fmt.number' },
        { l: 'Whole number', i: '0', c: 'fmt.int' },
        { l: 'Currency', i: '¤', c: 'fmt.currency' },
        { l: 'Accounting format', i: '$', c: 'fmt.accounting' },
        { l: 'Short date', i: '📅', c: 'fmt.date' },
        { l: 'Long date', i: '📅', c: 'fmt.datelong' },
        { l: 'Date yyyy-mm-dd', i: '📅', c: 'fmt.dateiso' },
        { l: 'Time', i: '⏱', c: 'fmt.time' },
        { l: 'Time with seconds', i: '⏱', c: 'fmt.timelong' },
        { l: 'Percentage', i: '%', c: 'fmt.percent' },
        { l: 'Percent with 2 decimals', i: '%', c: 'fmt.percent2' },
        { l: 'Mixed number', i: '½', c: 'fmt.fraction' },
        { l: 'Scientific', i: 'E', c: 'fmt.sci' },
        { l: 'Text', i: 'ab', c: 'fmt.text' },
      ],
    },
  ],
  [
    {
      l: 'Currency format',
      i: '¤',
      c: 'fmt.currency',
      menu: [
        { l: 'Currency: Indian rupee (₹)', i: '₹', c: 'fmt.cur.inr' },
        { l: 'Currency: US dollar ($)', i: '$', c: 'fmt.cur.usd' },
        { l: 'Currency: Euro (€)', i: '€', c: 'fmt.cur.eur' },
        { l: 'Currency: British pound (£)', i: '£', c: 'fmt.cur.gbp' },
        { l: 'Currency: Japanese yen (¥)', i: '¥', c: 'fmt.cur.jpy' },
        { l: 'Accounting format', i: '$', c: 'fmt.accounting' },
      ],
    },
    { l: 'Percent style', i: '%', c: 'fmt.percent' },
    { l: 'Comma style', i: ',', c: 'fmt.comma' },
    { l: 'Increase decimal', i: '.0→', c: 'fmt.dec.more' },
    { l: 'Decrease decimal', i: '←.0', c: 'fmt.dec.less' },
  ],
]);
