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

export async function sendCircleFlex(to, circle) {
  try {
    const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/circles/${circle.id}`;
    
    const flexMessage = {
      type: "flex",
      altText: `ข้อมูลวงแชร์: ${circle.name}`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "✨ ข้อมูลวงแชร์ ✨",
              weight: "bold",
              color: "#ffffff",
              size: "sm"
            }
          ],
          backgroundColor: "#38a169"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: circle.name,
              weight: "bold",
              size: "xl",
              margin: "md"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "box",
                  layout: "baseline",
                  spacing: "sm",
                  contents: [
                    {
                      type: "text",
                      text: "ยอดรวม",
                      color: "#aaaaaa",
                      size: "sm",
                      flex: 2
                    },
                    {
                      type: "text",
                      text: `${circle.total_amount.toLocaleString()} บาท`,
                      wrap: true,
                      color: "#666666",
                      size: "sm",
                      flex: 5
                    }
                  ]
                },
                {
                  type: "box",
                  layout: "baseline",
                  spacing: "sm",
                  contents: [
                    {
                      type: "text",
                      text: "ส่งงวดละ",
                      color: "#aaaaaa",
                      size: "sm",
                      flex: 2
                    },
                    {
                      type: "text",
                      text: `${circle.amount_per_hand.toLocaleString()} บาท`,
                      wrap: true,
                      color: "#666666",
                      size: "sm",
                      flex: 5
                    }
                  ]
                },
                {
                  type: "box",
                  layout: "baseline",
                  spacing: "sm",
                  contents: [
                    {
                      type: "text",
                      text: "จำนวนมือ",
                      color: "#aaaaaa",
                      size: "sm",
                      flex: 2
                    },
                    {
                      type: "text",
                      text: `${circle.total_hands} มือ`,
                      wrap: true,
                      color: "#666666",
                      size: "sm",
                      flex: 5
                    }
                  ]
                }
              ]
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              height: "sm",
              color: "#38a169",
              action: {
                type: "uri",
                label: "ดูรายละเอียด / จองมือ",
                uri: liffUrl
              }
            }
          ],
          flex: 0
        }
      }
    };

    await pushMessage(to, [flexMessage]);
  } catch (error) {
    console.error('Error sending Circle Flex:', error);
  }
}
