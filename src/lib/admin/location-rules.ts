export function areaMoveConflictsWithAddresses(
  currentCityId: string,
  nextCityId: string,
  addressCount: number,
) {
  return currentCityId !== nextCityId && addressCount > 0;
}
