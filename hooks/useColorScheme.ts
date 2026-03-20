/**
 * 앱 전역 다크모드 비활성화: 항상 light 반환
 */
export function useColorScheme() {
  return "light" as const;
}
