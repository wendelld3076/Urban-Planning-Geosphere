declare module 'shpjs' {
  const shp: any;
  export default shp;
}

declare module 'tz-lookup' {
  function tzlookup(lat: number, lon: number): string;
  export default tzlookup;
}
