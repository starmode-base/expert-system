import * as Ably from "ably";
import {
  AblyMessageCallback,
  AblyProvider,
  ChannelProvider,
  useChannel,
} from "ably/react";
import { ensureEnv } from "./env";

/**
 * Generate a channel name for the viewer
 */
const makeChannelName = (viewerId: string) => {
  return `private.user.${viewerId}`;
};

/**
 * Ably event name
 */
const eventName = `invalidate-cache`;

/**
 * Ably client
 *
 * https://ably.com/docs/getting-started/react#AblyProvider
 */
const client = new Ably.Realtime({
  authUrl: "/api/ably-auth",
  authMethod: "POST",
});

/**
 * Ably React provider
 *
 * https://ably.com/docs/getting-started/react#AblyProvider
 */
export function PubSubProvider(
  props: React.PropsWithChildren<{ viewerId: string }>,
) {
  return (
    <AblyProvider client={client}>
      <ChannelProvider channelName={makeChannelName(props.viewerId)}>
        {props.children}
      </ChannelProvider>
    </AblyProvider>
  );
}

/**
 * Create a token request for the Ably client
 *
 * https://ably.com/docs/auth/token
 * https://ably.com/docs/auth/capabilities
 */
export const createTokenRequest = async (viewerId: string) => {
  const ably = new Ably.Rest(ensureEnv("ABLY_API_KEY"));

  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: viewerId,
    capability: {
      [makeChannelName(viewerId)]: ["subscribe"],
    },
  });

  return tokenRequest;
};

/**
 * Subscribe to the Ably 'notify-ui' channel for the 'invalidate-cache' event
 *
 * https://ably.com/docs/getting-started/react#useChannel
 */
export function useNotifyUI(viewerId: string, callback: AblyMessageCallback) {
  return useChannel(makeChannelName(viewerId), callback);
}

/**
 * Publish a message to the Ably 'notify-ui' channel for the 'invalidate-cache'
 * event
 *
 * https://ably.com/docs/api/rest-sdk/channels?lang=javascript#publish
 */
export function publishNotifyUI(
  viewerId: string,
  data?: string,
): Promise<void> {
  const ably = new Ably.Rest(ensureEnv("ABLY_API_KEY"));

  const channel = ably.channels.get(makeChannelName(viewerId));

  return channel.publish(eventName, data);
}
