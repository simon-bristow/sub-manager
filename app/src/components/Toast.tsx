import { useEffect, useState } from 'react';

let setMsgGlobal: ((msg: string | null) => void) | null = null;

export function showToast(msg: string, ms = 2000): void {
  if (!setMsgGlobal) return;
  setMsgGlobal(msg);
  window.setTimeout(() => {
    if (setMsgGlobal) setMsgGlobal(null);
  }, ms);
}

export function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    setMsgGlobal = setMsg;
    return () => {
      setMsgGlobal = null;
    };
  }, []);
  return (
    <div className={`saving-toast${msg ? ' visible' : ''}`}>{msg ?? ''}</div>
  );
}
