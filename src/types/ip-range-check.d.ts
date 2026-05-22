declare module 'ip-range-check' {
  function ipRangeCheck(ip: string, cidrs: string | string[]): boolean;
  export = ipRangeCheck;
}