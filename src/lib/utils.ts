export function normalizeDigits(value:string) {
  return value.replace(/[٠-٩]/g,char=>String(char.charCodeAt(0)-0x0660)).replace(/[۰-۹]/g,char=>String(char.charCodeAt(0)-0x06f0));
}
