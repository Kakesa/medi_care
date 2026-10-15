import { useEffect, useRef, useState } from "react";

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then: unknown }).then === "function"
  );
}

/** Ignores a second click until the first async handler has finished. */
export function usePendingClick<E extends { preventDefault: () => void; stopPropagation: () => void }>(
  onClick: ((event: E) => unknown) | undefined,
  disabled?: boolean,
) {
  const lock = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleClick = (event: E) => {
    if (disabled || lock.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const result = onClick?.(event);
    if (!isThenable(result)) return;

    lock.current = true;
    setPending(true);
    void result.finally(() => {
      lock.current = false;
      if (mounted.current) setPending(false);
    });
  };

  return { pending, handleClick };
}
