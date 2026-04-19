import { useEffect, useState } from "react";

function getItemFromLocalStorage(key: string) {
  if (typeof window === "undefined") return null;

  const item = window.localStorage.getItem(key);
  if (item) return JSON.parse(item);

  return null;
}

//用来在浏览器中读写 localStorage，并且在组件每次渲染时自动同步最新值。如果不是浏览器环境，就返回 null。
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState(
    getItemFromLocalStorage(key) ?? initialValue,
  );

  useEffect(() => {
    // Retrieve from localStorage
    const item = getItemFromLocalStorage(key);
    if (item) setStoredValue(item);
  }, [key]);

  //“更新 React 状态，同时把这个值保存到浏览器的 localStorage 里。”
  const setValue = (value: T) => {
    // Save state
    setStoredValue(value);
    // Save to localStorage
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  return [storedValue, setValue];
}
