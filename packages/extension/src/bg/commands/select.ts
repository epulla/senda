import { fill } from './type';
export default function select(p: { ref: string; value: string | string[]; tabId?: number }) {
  return fill(p.ref, p.value, false, p.tabId, true);
}
