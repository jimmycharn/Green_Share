import { messagingApi } from '@line/bot-sdk';

const { MessagingApiClient } = messagingApi;

const client = new MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

export async function replyMessage(replyToken, text) {
  try {
    await client.replyMessage({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }]
    });
  } catch (error) {
    console.error('Error replying message:', error);
  }
}

export async function pushMessage(to, messages) {
  try {
    const formattedMessages = Array.isArray(messages) 
      ? messages 
      : [{ type: 'text', text: messages }];
      
    await client.pushMessage({
      to: to,
      messages: formattedMessages
    });
  } catch (error) {
    console.error('Error pushing message:', error);
  }
}

export async function notifyAdmin(text) {
  if (!process.env.ADMIN_LINE_UID) return;
  await pushMessage(process.env.ADMIN_LINE_UID, [{ type: 'text', text: `[System Notify]\n${text}` }]);
}
