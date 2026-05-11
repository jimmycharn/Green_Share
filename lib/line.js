import { messagingApi } from '@line/bot-sdk';

const { MessagingApiClient } = messagingApi;

const client = new MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

export async function replyMessage(replyToken, text) {
  try {
    await client.replyMessage({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }],
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
      messages: formattedMessages,
    });
  } catch (error) {
    console.error('Error pushing message:', error);
  }
}

export async function notifyAdmin(text) {
  if (!process.env.ADMIN_LINE_UID) return;
  await pushMessage(process.env.ADMIN_LINE_UID, [
    { type: 'text', text: `[System Notify]\n${text}` },
  ]);
}

export async function sendSlipNotificationToAdmin(
  to,
  { circleName, memberName, period, amount, circleId, isCash }
) {
  if (!to) return;
  const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/circles/${circleId}`;
  const msgType = isCash ? '💵 รับเงินสด' : '🧾 ส่งสลิปใหม่';

  const flexMessage = {
    type: 'flex',
    altText: `${msgType}: ${memberName} งวด ${period}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#f59e0b',
        contents: [{ type: 'text', text: msgType, weight: 'bold', color: '#ffffff', size: 'sm' }],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: circleName, weight: 'bold', size: 'lg', margin: 'md', wrap: true },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'สมาชิก', color: '#aaaaaa', size: 'sm', flex: 2 },
                  {
                    type: 'text',
                    text: memberName,
                    wrap: true,
                    color: '#1e293b',
                    size: 'sm',
                    flex: 5,
                    weight: 'bold',
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'งวดที่', color: '#aaaaaa', size: 'sm', flex: 2 },
                  {
                    type: 'text',
                    text: String(period),
                    wrap: true,
                    color: '#1e293b',
                    size: 'sm',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'จำนวน', color: '#aaaaaa', size: 'sm', flex: 2 },
                  {
                    type: 'text',
                    text: `${Number(amount).toLocaleString()} บาท`,
                    wrap: true,
                    color: '#16a34a',
                    size: 'sm',
                    flex: 5,
                    weight: 'bold',
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        flex: 0,
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: '#f59e0b',
            action: { type: 'uri', label: '🔍 ตรวจสอบสลิป', uri: liffUrl },
          },
        ],
      },
    },
  };

  await pushMessage(to, [flexMessage]).catch((e) =>
    console.error('sendSlipNotification error:', e)
  );
}

export async function sendPayoutNotificationToMember(
  to,
  { circleName, period, amount, circleId, isCash, autoApproved }
) {
  if (!to) return;
  const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/circles/${circleId}`;
  const headerText = isCash ? '💵 แจ้งรับเงินสดจากวงแชร์' : '💰 แจ้งการโอนเงินจากวงแชร์';
  const btnLabel = autoApproved ? '📋 ดูรายละเอียด' : '✅ ตรวจสอบการรับเงิน';

  const flexMessage = {
    type: 'flex',
    altText: `${headerText}: ${circleName} งวด ${period}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#16a34a',
        contents: [
          { type: 'text', text: headerText, weight: 'bold', color: '#ffffff', size: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: circleName, weight: 'bold', size: 'lg', margin: 'md', wrap: true },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'งวดที่', color: '#aaaaaa', size: 'sm', flex: 2 },
                  {
                    type: 'text',
                    text: String(period),
                    wrap: true,
                    color: '#1e293b',
                    size: 'sm',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'จำนวน', color: '#aaaaaa', size: 'sm', flex: 2 },
                  {
                    type: 'text',
                    text: `${Number(amount).toLocaleString()} บาท`,
                    wrap: true,
                    color: '#16a34a',
                    size: 'sm',
                    flex: 5,
                    weight: 'bold',
                  },
                ],
              },
            ],
          },
          {
            type: 'text',
            text: autoApproved
              ? 'ยืนยันการรับเงินเรียบร้อยแล้ว'
              : 'กรุณาเปิดแอปเพื่อตรวจสอบและยืนยันการรับเงิน',
            size: 'xs',
            color: '#6b7280',
            margin: 'lg',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        flex: 0,
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: '#16a34a',
            action: { type: 'uri', label: btnLabel, uri: liffUrl },
          },
        ],
      },
    },
  };

  await pushMessage(to, [flexMessage]).catch((e) =>
    console.error('sendPayoutNotification error:', e)
  );
}

export async function sendBidStartNotification(
  to,
  { circleName, period, minBid, maxBid, circleId }
) {
  if (!to) return;
  const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/circles/${circleId}`;

  const flexMessage = {
    type: 'flex',
    altText: `🔔 เปิดประมูลแล้ว! ${circleName} งวดที่ ${period}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#10b981',
        contents: [
          {
            type: 'text',
            text: '🔔 เปิดประมูลแล้ว!',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: circleName, weight: 'bold', size: 'lg', margin: 'md', wrap: true },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'งวดที่', color: '#aaaaaa', size: 'sm', flex: 2 },
                  {
                    type: 'text',
                    text: String(period),
                    color: '#1e293b',
                    size: 'sm',
                    flex: 5,
                    weight: 'bold',
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'ดอกขั้นต่ำ', color: '#aaaaaa', size: 'sm', flex: 2 },
                  {
                    type: 'text',
                    text: `${Number(minBid).toLocaleString()} บาท`,
                    color: '#16a34a',
                    size: 'sm',
                    flex: 5,
                    weight: 'bold',
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'ดอกสูงสุด', color: '#aaaaaa', size: 'sm', flex: 2 },
                  {
                    type: 'text',
                    text: `${Number(maxBid).toLocaleString()} บาท`,
                    color: '#ef4444',
                    size: 'sm',
                    flex: 5,
                    weight: 'bold',
                  },
                ],
              },
            ],
          },
          {
            type: 'text',
            text: 'กดปุ่มด้านล่างเพื่อเข้าร่วมประมูล',
            size: 'xs',
            color: '#6b7280',
            margin: 'lg',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        flex: 0,
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: '#10b981',
            action: { type: 'uri', label: '🔨 ประมูล (เปีย)', uri: liffUrl },
          },
        ],
      },
    },
  };

  await pushMessage(to, [flexMessage]).catch((e) =>
    console.error('sendBidStartNotification error:', e)
  );
}

export async function sendCircleFlex(to, circle) {
  console.log(`Attempting to send Flex Message to: ${to} for circle: ${circle.id}`);
  try {
    if (!to) {
      console.error('Error: Recipient UID (to) is missing');
      return;
    }

    const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/circles/${circle.id}?tab=members`;
    console.log(`Generated LIFF URL: ${liffUrl}`);

    const flexMessage = {
      type: 'flex',
      altText: `ข้อมูลวงแชร์: ${circle.name}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '✨ ข้อมูลวงแชร์ ✨',
              weight: 'bold',
              color: '#ffffff',
              size: 'sm',
            },
          ],
          backgroundColor: '#38a169',
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: circle.name || 'ไม่ระบุชื่อวง',
              weight: 'bold',
              size: 'xl',
              margin: 'md',
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'ยอดรวม',
                      color: '#aaaaaa',
                      size: 'sm',
                      flex: 2,
                    },
                    {
                      type: 'text',
                      text: `${(circle.total_amount || 0).toLocaleString()} บาท`,
                      wrap: true,
                      color: '#666666',
                      size: 'sm',
                      flex: 5,
                    },
                  ],
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'ส่งงวดละ',
                      color: '#aaaaaa',
                      size: 'sm',
                      flex: 2,
                    },
                    {
                      type: 'text',
                      text: `${(circle.amount_per_hand || 0).toLocaleString()} บาท`,
                      wrap: true,
                      color: '#666666',
                      size: 'sm',
                      flex: 5,
                    },
                  ],
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'จำนวนมือ',
                      color: '#aaaaaa',
                      size: 'sm',
                      flex: 2,
                    },
                    {
                      type: 'text',
                      text: `${circle.total_hands || 0} มือ`,
                      wrap: true,
                      color: '#666666',
                      size: 'sm',
                      flex: 5,
                    },
                  ],
                },
              ],
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              color: '#38a169',
              action: {
                type: 'uri',
                label: 'ดูรายละเอียด / จองมือ',
                uri: liffUrl,
              },
            },
          ],
          flex: 0,
        },
      },
    };

    await pushMessage(to, [flexMessage]);
    console.log('Flex Message sent successfully!');
  } catch (error) {
    console.error('Error sending Circle Flex:', error);
  }
}

export async function sendPaymentReminder(to, { circleName, period, amount, dueDate, circleId }) {
  if (!to) return;
  const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/circles/${circleId}?tab=timeline&period=${period}`;
  const text = `⏰ แจ้งเตือนชำระเงินวงแชร์\n\nวง: ${circleName}\nงวดที่: ${period}\nยอดที่ต้องจ่าย: ${Number(amount).toLocaleString()} บาท${dueDate ? `\nกำหนดจ่าย: ${dueDate}` : ''}\n\nกรุณาชำระเงินและส่งสลิปให้ท้าวแชร์ตรวจสอบ`;
  const flexMessage = {
    type: 'flex',
    altText: `แจ้งเตือนชำระเงินงวดที่ ${period} - ${circleName}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '⏰ แจ้งเตือนชำระเงิน', weight: 'bold', color: '#ffffff', size: 'sm' },
        ],
        backgroundColor: '#f59e0b',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: circleName, weight: 'bold', size: 'xl', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'งวดที่', color: '#aaaaaa', size: 'sm', flex: 2 },
                  { type: 'text', text: `${period}`, wrap: true, color: '#666666', size: 'sm', flex: 5 },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'ยอดจ่าย', color: '#aaaaaa', size: 'sm', flex: 2 },
                  { type: 'text', text: `${Number(amount).toLocaleString()} บาท`, wrap: true, color: '#dc2626', size: 'sm', flex: 5, weight: 'bold' },
                ],
              },
              ...(dueDate
                ? [
                    {
                      type: 'box',
                      layout: 'baseline',
                      spacing: 'sm',
                      contents: [
                        { type: 'text', text: 'กำหนดจ่าย', color: '#aaaaaa', size: 'sm', flex: 2 },
                        { type: 'text', text: dueDate, wrap: true, color: '#666666', size: 'sm', flex: 5 },
                      ],
                    },
                  ]
                : []),
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: '#f59e0b',
            action: { type: 'uri', label: '💰 ชำระเงิน / ส่งสลิป', uri: liffUrl },
          },
        ],
        flex: 0,
      },
    },
  };
  try {
    await pushMessage(to, [flexMessage]);
  } catch (error) {
    console.error('Error sending payment reminder:', error);
  }
}
