export function useColorScheme() {
  // 웹에서도 다크모드 비활성화: 항상 light 반환
  return "light" as const;
}
