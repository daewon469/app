// app/index.tsx
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";

export default function Index() {
  useEffect(() => {

    (async () => {
      const autologin = await SecureStore.getItemAsync("isLogin");
      console.log("isLogin:", autologin);
      router.replace("/list")
      //  autologin === "true" ? router.replace("/list") : router.replace("/login");
    })();
  }, []);

  return null;
}