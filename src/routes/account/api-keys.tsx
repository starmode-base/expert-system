import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  createApiKeySF,
  listApiKeysSF,
  revokeApiKeySF,
  type ApiKeyListItem,
} from "~/server/api-keys";

export const Route = createFileRoute("/account/api-keys")({
  loader: async () => {
    const apiKeys = await listApiKeysSF();
    return { apiKeys };
  },
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const { apiKeys } = Route.useLoaderData();
  const router = useRouter();

  const createApiKey = useServerFn(createApiKeySF);
  const revokeApiKey = useServerFn(revokeApiKeySF);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setCreateError(null);
    try {
      const result = await createApiKey({ data: { name: name.trim() } });
      setNewRawKey(result.rawKey);
      setName("");
      void router.invalidate();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create key",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!newRawKey) return;
    await navigator.clipboard.writeText(newRawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (keyId: string) => {
    setRevoking(keyId);
    try {
      await revokeApiKey({ data: { keyId } });
      void router.invalidate();
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">API Keys</h1>

      {/* Create key form */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">
          Create a new API key
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Use API keys to authenticate requests to the REST API.
        </p>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            placeholder="Key name (e.g. My App)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={creating}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="cursor-pointer rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create key"}
          </button>
        </form>
        {createError ? (
          <p className="mt-2 text-sm text-red-600">{createError}</p>
        ) : null}
      </section>

      {/* One-time key display banner */}
      {newRawKey ? (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-medium text-amber-800">
            Copy your API key now — it won't be shown again.
          </p>
          <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2">
            <code className="flex-1 font-mono text-sm break-all text-gray-900">
              {newRawKey}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 cursor-pointer rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setNewRawKey(null)}
            className="cursor-pointer text-sm font-medium text-amber-700 underline hover:text-amber-900"
          >
            I've saved it — dismiss
          </button>
        </div>
      ) : null}

      {/* Keys list */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-medium text-gray-900">Your API keys</h2>
        </div>
        {apiKeys.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No API keys yet. Create one above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Prefix</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3">Last used</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apiKeys.map((key: ApiKeyListItem) => (
                <tr key={key.id} className={key.revokedAt ? "opacity-50" : ""}>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {key.name}
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-600">
                    {key.keyPrefix}…
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {formatDate(key.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {formatDate(key.lastUsedAt)}
                  </td>
                  <td className="px-6 py-4">
                    {key.revokedAt ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Revoked
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!key.revokedAt ? (
                      <button
                        onClick={() => handleRevoke(key.id)}
                        disabled={revoking === key.id}
                        className="cursor-pointer rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {revoking === key.id ? "Revoking..." : "Revoke"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
