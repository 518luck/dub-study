import { stableSort } from "@dub/utils";
import {
  Dispatch,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";

type KeyboardShortcutListener = {
  id: string; // 当前快捷键监听器的唯一标识
  key: string | string[]; // 需要监听的快捷键，可以是单个，也可以是一组
  enabled?: boolean; // 当前监听器是否启用
  priority?: number; // 多个监听器同时命中时的优先级，值越大越优先
  modal?: boolean; // 是否只在 modal 打开时生效
  sheet?: boolean; // 是否只在 sheet / drawer 打开时生效
};

// 1. 创建 Context
export const KeyboardShortcutContext = createContext<{
  // 定义了该 Context 提供的数据结构
  listeners: KeyboardShortcutListener[];
  setListeners: Dispatch<SetStateAction<KeyboardShortcutListener[]>>;
}>({
  listeners: [] as KeyboardShortcutListener[],
  setListeners: () => {},
});

// 给下面整棵组件树提供一个“快捷键监听器列表”的共享状态。
export function KeyboardShortcutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [listeners, setListeners] = useState<KeyboardShortcutListener[]>([]);

  return (
    <KeyboardShortcutContext.Provider value={{ listeners, setListeners }}>
      {children}
    </KeyboardShortcutContext.Provider>
  );
}

export function useKeyboardShortcut(
  key: KeyboardShortcutListener["key"],
  callback: (e: KeyboardEvent) => void,
  options: Pick<
    KeyboardShortcutListener,
    "enabled" | "priority" | "modal" | "sheet"
  > = {},
) {
  const id = useId();

  const { listeners, setListeners } = useContext(KeyboardShortcutContext);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (options.enabled === false) return;

      const target = e.target as HTMLElement;
      const existingModalBackdrop = document.getElementById("modal-backdrop");
      const existingSheetBackdrop = document.querySelector(
        "[data-sheet-overlay]",
      );

      // Ignore shortcuts if the user is typing in an input or textarea, or in a modal
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        !!existingModalBackdrop !== !!options.modal ||
        !!existingSheetBackdrop !== !!options.sheet
      )
        return;

      const pressedKey = [
        ...(e.metaKey ? ["meta"] : []),
        ...(e.ctrlKey ? ["ctrl"] : []),
        ...(e.altKey ? ["alt"] : []),
        e.key,
      ].join("+");

      // Ignore shortcut if it doesn't match this listener
      if (Array.isArray(key) ? !key.includes(pressedKey) : pressedKey !== key)
        return;

      // Find enabled listeners that match the key
      const matchingListeners = listeners.filter(
        (l) =>
          l.enabled !== false &&
          !!existingModalBackdrop === !!l.modal &&
          !!existingSheetBackdrop === !!l.sheet &&
          (Array.isArray(l.key)
            ? l.key.includes(pressedKey)
            : l.key === pressedKey),
      );

      if (!matchingListeners.length) return;

      // Sort the listeners by priority
      const topListener = stableSort(
        matchingListeners,
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
      )[0];

      // Check if this is the top listener
      if (topListener.id !== id) return;

      e.preventDefault();
      callback(e);
    },
    [
      key,
      listeners,
      id,
      callback,
      options.enabled,
      options.modal,
      options.sheet,
    ],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  // Register/unregister the listener
  useEffect(() => {
    setListeners((prev) => [
      ...prev.filter((listener) => listener.id !== id),
      { id, key, ...options },
    ]);

    return () =>
      setListeners((prev) => prev.filter((listener) => listener.id !== id));
  }, [JSON.stringify(key), options.enabled, options.priority]);
}
