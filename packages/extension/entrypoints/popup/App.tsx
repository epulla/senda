import { statusItem } from '@/src/bg/state';
import { STATUS } from '@/src/ui/status';
import { useItem } from '@/src/ui/useItem';

export default function App() {
  const [status] = useItem(statusItem);
  const { label, dot } = STATUS[status];
  return (
    <main className="w-72 space-y-3 p-4 text-sm">
      <h1 className="text-lg font-semibold">Senda</h1>
      <p role="status" className="flex items-center gap-2">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${dot}`} />
        {label}
      </p>
      <a href="/onboarding.html" target="_blank" className="text-blue-700 underline">
        {status === 'invalid_token' ? 'Paste the code' : 'Setup'}
      </a>
    </main>
  );
}
