import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import {
  getXBookmarksAuthStatusSF,
  disconnectXBookmarksSF,
} from "~/server/x-bookmarks";

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    x_connected: search.x_connected === "true",
  }),
  loader: async () => {
    const xBookmarksStatus = await getXBookmarksAuthStatusSF();
    return { xBookmarksStatus };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { xBookmarksStatus } = Route.useLoaderData();
  const { x_connected } = useSearch({ from: "/settings" });
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(x_connected);

  const disconnectXBookmarks = useServerFn(disconnectXBookmarksSF);

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [showSuccess]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectXBookmarks();
      void router.invalidate();
    } finally {
      setDisconnecting(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Settings</h1>

      {showSuccess ? (
        <div className="mb-6 rounded-md bg-green-50 p-4 text-sm text-green-700">
          X account connected successfully.
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">
          X Bookmarks Integration
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Connect your X account to automatically sync your bookmarks as
          documents for analysis.
        </p>

        {xBookmarksStatus.isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700">
                Connected
              </span>
            </div>

            <div className="rounded-md bg-gray-50 p-4 text-sm">
              <div className="grid gap-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">X User ID:</span>
                  <span className="font-mono text-gray-900">
                    {xBookmarksStatus.xUserId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Token Expires:</span>
                  <span className="text-gray-900">
                    {formatDate(xBookmarksStatus.expiresAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Sync Cursor:</span>
                  <span className="font-mono text-gray-900">
                    {xBookmarksStatus.lastSyncCursor ?? "None"}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="cursor-pointer rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
              <span className="text-sm font-medium text-gray-500">
                Not connected
              </span>
            </div>

            <a
              href="/api/x-bookmarks-start"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Connect X Account
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
