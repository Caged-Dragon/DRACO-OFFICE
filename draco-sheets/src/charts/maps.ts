// Built-in map data (v72). No downloads: tile-grid cartograms (US, India) and a lon/lat bubble map (world).
export type MapKind = 'us' | 'in' | 'world';
export const MAP_KINDS: Array<[MapKind, string]> = [
  ['us', 'United States (tile map)'],
  ['in', 'India (tile map)'],
  ['world', 'World (bubble map)'],
];
type Row = [code: string, name: string, a: number, b: number]; // tile: col,row — world: lon,lat
const parse = (s: string): Row[] =>
  s.split(';').map((x) => {
    const [code, name, a, b] = x.split('|');
    return [code, name, +a, +b] as Row;
  });

export const US = parse(
  'AK|Alaska|0|0;VT|Vermont|9|0;ME|Maine|10|0;WA|Washington|0|1;ID|Idaho|1|1;MT|Montana|2|1;ND|North Dakota|3|1;MN|Minnesota|4|1;WI|Wisconsin|5|1;MI|Michigan|6|1;NY|New York|8|1;MA|Massachusetts|9|1;NH|New Hampshire|10|1;OR|Oregon|0|2;NV|Nevada|1|2;WY|Wyoming|2|2;SD|South Dakota|3|2;IA|Iowa|4|2;IL|Illinois|5|2;IN|Indiana|6|2;OH|Ohio|7|2;PA|Pennsylvania|8|2;NJ|New Jersey|9|2;CT|Connecticut|10|2;CA|California|0|3;UT|Utah|1|3;CO|Colorado|2|3;NE|Nebraska|3|3;MO|Missouri|4|3;KY|Kentucky|5|3;WV|West Virginia|6|3;VA|Virginia|7|3;MD|Maryland|8|3;DE|Delaware|9|3;RI|Rhode Island|10|3;AZ|Arizona|1|4;NM|New Mexico|2|4;KS|Kansas|3|4;AR|Arkansas|4|4;TN|Tennessee|5|4;NC|North Carolina|6|4;SC|South Carolina|7|4;DC|District of Columbia|8|4;OK|Oklahoma|3|5;LA|Louisiana|4|5;MS|Mississippi|5|5;AL|Alabama|6|5;GA|Georgia|7|5;HI|Hawaii|0|6;TX|Texas|3|6;FL|Florida|8|6',
);
export const IN = parse(
  'JK|Jammu and Kashmir|2|0;LA|Ladakh|3|0;PB|Punjab|2|1;HP|Himachal Pradesh|3|1;UK|Uttarakhand|4|1;RJ|Rajasthan|1|2;HR|Haryana|2|2;DL|Delhi|3|2;UP|Uttar Pradesh|4|2;BR|Bihar|5|2;SK|Sikkim|6|2;AS|Assam|7|2;AR|Arunachal Pradesh|8|2;GJ|Gujarat|1|3;MP|Madhya Pradesh|3|3;CG|Chhattisgarh|4|3;JH|Jharkhand|5|3;WB|West Bengal|6|3;ML|Meghalaya|7|3;NL|Nagaland|8|3;MH|Maharashtra|2|4;TG|Telangana|3|4;OD|Odisha|5|4;TR|Tripura|7|4;MN|Manipur|8|4;GA|Goa|1|5;KA|Karnataka|2|5;AP|Andhra Pradesh|3|5;MZ|Mizoram|8|5;LD|Lakshadweep|0|6;KL|Kerala|2|6;TN|Tamil Nadu|3|6;PY|Puducherry|4|6;AN|Andaman and Nicobar Islands|7|6',
);
export const WORLD = parse(
  'US|United States|-98|39;CA|Canada|-106|56;MX|Mexico|-102|23;BR|Brazil|-52|-10;AR|Argentina|-64|-34;CL|Chile|-71|-30;CO|Colombia|-74|4;PE|Peru|-75|-10;GB|United Kingdom|-2|54;IE|Ireland|-8|53;FR|France|2|46;ES|Spain|-4|40;PT|Portugal|-8|39;DE|Germany|10|51;IT|Italy|12|42;NL|Netherlands|5|52;SE|Sweden|15|62;NO|Norway|9|61;FI|Finland|26|64;PL|Poland|19|52;UA|Ukraine|31|49;TR|Turkey|35|39;RU|Russia|90|60;EG|Egypt|30|27;NG|Nigeria|8|9;ZA|South Africa|24|-29;KE|Kenya|38|0;ET|Ethiopia|40|9;MA|Morocco|-6|32;DZ|Algeria|3|28;SA|Saudi Arabia|45|24;AE|United Arab Emirates|54|24;IR|Iran|53|32;IQ|Iraq|44|33;PK|Pakistan|70|30;IN|India|79|22;BD|Bangladesh|90|24;LK|Sri Lanka|81|8;CN|China|104|35;JP|Japan|138|36;KR|South Korea|128|36;TH|Thailand|101|15;VN|Vietnam|108|14;MY|Malaysia|102|4;SG|Singapore|104|1;ID|Indonesia|113|-2;PH|Philippines|122|13;AU|Australia|134|-25;NZ|New Zealand|172|-41;KZ|Kazakhstan|67|48',
);
export const TABLE: Record<MapKind, Row[]> = { us: US, in: IN, world: WORLD };
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
/** Resolve a cell label (code or full name) to a map row. */
export function resolveRegion(kind: MapKind, label: string): Row | undefined {
  const k = norm(label);
  return TABLE[kind].find((r) => r[0].toLowerCase() === k || norm(r[1]) === k);
}
