/* =========================================
   BACKEND API: Green Share App (FULL EXPANDED VERSION)
   ========================================= */

// 🔴🔴🔴 1. Config 🔴🔴🔴
const CHANNEL_ACCESS_TOKEN = "+LgVfxhjHTS3YkqQxKHbrFkAw/5Ms48+7cWCroGHX3fsDkWJo/rJbQ1ui2qnirdH/XJN35O/KsSJQLe6mHcONG7RsD1t607hnyTFTW43VC3Esf3t/C0jmhufnKOrY4ngInm6VLSTD8ClLKLqZKhJYAdB04t89/1O/w1cDnyilFU="; 
const ADMIN_USER_ID = "Uf129b8220ec5880321b21ba99f3c02bf"; 

function doPost(e) {
  try {
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch(err) {
      data = e.parameter;
    }
    
    // --- Router ---
    if (data.action == 'register') return registerMember(data);
    if (data.action == 'update_profile') return updateProfile(data);
    if (data.action == 'create_circle') return createCircle(data);
    if (data.action == 'get_circles') return getCircles(data);
    if (data.action == 'get_circle_detail') return getCircleDetail(data);
    if (data.action == 'join_circle') return joinCircle(data);
    if (data.action == 'submit_bid') return submitBid(data);
    if (data.action == 'upload_slip') return uploadSlip(data);
    
    // Admin Functions
    if (data.action == 'get_pending_members') return getPendingMembers(data);
    if (data.action == 'update_member_status') return updateMemberStatus(data);
    if (data.action == 'get_all_active_members') return getAllActiveMembers(data);
    if (data.action == 'manage_slot') return manageSlot(data);
    if (data.action == 'get_all_members_manage') return getAllMembersForManagement(data);
    if (data.action == 'update_user_role') return updateUserRole(data);
    if (data.action == 'close_period') return closePeriod(data);
    if (data.action == 'get_payment_checklist') return getPaymentChecklist(data);
    if (data.action == 'approve_payment') return approvePayment(data);
    
    // Bank Account
    if (data.action == 'get_default_bank') return getDefaultBankAccount();
    if (data.action == 'get_member_bank_display') return getMemberBankDisplay(data);
    if (data.action == 'get_all_bank_accounts') return getAllBankAccounts(data);
    if (data.action == 'get_all_bank_accounts_full') return getAllBankAccountsFull(data);
    if (data.action == 'add_bank_account') return addBankAccount(data);
    if (data.action == 'update_bank_account') return updateBankAccount(data);
    if (data.action == 'delete_bank_account') return deleteBankAccount(data);
    if (data.action == 'set_default_bank') return setDefaultBankAccount(data);
    if (data.action == 'assign_member_bank') return assignMemberBank(data);
    if (data.action == 'get_member_bank_info') return getMemberBankInfo(data);
    if (data.action == 'admin_pay_winner') return adminPayWinner(data);
    if (data.action == 'confirm_admin_payment') return confirmAdminPayment(data);
    if (data.action == 'reject_admin_payment') return rejectAdminPayment(data);
    if (data.action == 'approve_slip') return approveSlip(data);
    if (data.action == 'reject_slip') return rejectSlip(data);
    if (data.action == 'random_select_bidder') return randomSelectBidder(data);
    if (data.action == 'update_circle_settings') return updateCircleSettings(data);
    // Auto-Assign Hand
    if (data.action == 'find_next_bidding_hand') return findNextBiddingHandCaller(data);

    return responseJSON({ status: 'error', message: 'Unknown action: ' + data.action });
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function sendLineMessage(text, imageUrl) {
  var messages = [];
  if (text) messages.push({ "type": "text", "text": text.trim() });
  if (imageUrl) messages.push({ "type": "image", "originalContentUrl": imageUrl, "previewImageUrl": imageUrl });
  
  var payload = { "to": ADMIN_USER_ID, "messages": messages };
  var options = {
    "method": "post",
    "headers": { "Content-Type": "application/json", "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN },
    "payload": JSON.stringify(payload)
  };
  try { 
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options); 
  } catch (e) { 
    console.log("Push Error: " + e.toString()); 
  }
}

// =========================================
// 1. Member Functions
// =========================================

function registerMember(data) {
  const sheet = getSheet('Members');
  const rows = sheet.getDataRange().getValues();
  for(let i=1; i<rows.length; i++) {
    if(rows[i][3] == data.line_id) {
      return responseJSON({ 
          status: 'success', 
          message: 'Welcome back',
          id: rows[i][0], 
          name: rows[i][1], 
          nickname: rows[i][2], 
          phone: rows[i][4], 
          bank_account: rows[i][5], 
          role: rows[i][7], 
          member_status: rows[i][8]
      }); 
    }
  }
  const newId = generateNextId(sheet, 'M');
  sheet.appendRow([newId, data.name, data.nickname, data.line_id, data.phone, data.bank_account, new Date(), 'MEMBER', 'PENDING']);
  sendLineMessage(`👤 สมาชิกใหม่รออนุมัติ!\nชื่อ: ${data.name} (${data.nickname})`);
  return responseJSON({ status: 'success', message: 'Registered (Pending)', id: newId, name: data.name, nickname: data.nickname, phone: data.phone, bank_account: data.bank_account, role: 'MEMBER', member_status: 'PENDING' });
}

function updateProfile(data) {
  const sheet = getSheet('Members');
  const rows = sheet.getDataRange().getValues();
  let found = false;
  for(let i=1; i<rows.length; i++) {
    if(rows[i][3] == data.line_id) { 
      sheet.getRange(i+1, 2).setValue(data.name); 
      sheet.getRange(i+1, 3).setValue(data.nickname);
      sheet.getRange(i+1, 5).setValue(data.phone); 
      sheet.getRange(i+1, 6).setValue(data.bank_account);
      found = true; 
      break;
    }
  }
  return found ? responseJSON({ status: 'success', message: 'แก้ไขข้อมูลเรียบร้อย' }) : responseJSON({ status: 'error', message: 'ไม่พบข้อมูลสมาชิก' });
}

// =========================================
// 2. Circle Functions
// =========================================

function createCircle(data) {
  const sheet = getSheet('Circles'); 
  const newId = generateNextId(sheet, 'C');
  
  // Period settings with defaults
  const periodType = data.period_type || 'WEEKLY';
  const periodValue = data.period_value || 'MON';
  const periodExtra = data.period_extra || '';
  const periodInterval = parseInt(data.period_interval) || 7;
  const bidStartTime = data.bid_start_time || '12:00';
  const bidEndTime = data.bid_end_time || '18:00';
  const notifyHours = parseInt(data.notify_hours) || 24;
  const notifyMessage = data.notify_message || '';
  const minBid = parseInt(data.min_bid) || 0;
  const maxBid = parseInt(data.max_bid) || 500;
  const closeMode = data.close_mode || 'MANUAL';
  const autoAction = data.auto_action || 'NOTIFY';
  
  const nextPeriodDate = calculateNextPeriodDate(periodType, periodValue, periodExtra, periodInterval, data.start_date);
  
  // Columns: A-K (existing) + L-X (new period settings)
  sheet.appendRow([
    newId, data.circle_name, data.type, data.total_amount, data.amount_per_hand, 
    data.total_hands, data.start_date, 'OPEN', new Date(), '', 1,
    periodType, periodValue, periodExtra, periodInterval,
    bidStartTime, bidEndTime, notifyHours, notifyMessage,
    minBid, maxBid, closeMode, autoAction, nextPeriodDate
  ]);
  
  sendLineMessage(`✨ เปิดวงใหม่!\nชื่อวง: ${data.circle_name}\nส่งงวดละ: ${data.amount_per_hand}`);
  return responseJSON({ status: 'success', id: newId });
}

// คำนวณวันเปียถัดไป
function calculateNextPeriodDate(periodType, periodValue, periodExtra, periodInterval, startDate) {
  const now = new Date();
  let nextDate = startDate ? new Date(startDate) : new Date();
  
  if (nextDate > now) return nextDate;
  
  switch(periodType) {
    case 'INTERVAL':
      while (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + periodInterval);
      }
      break;
    case 'WEEKLY':
      const dayMap = { 'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6 };
      const targetDay = dayMap[periodValue] || 1;
      nextDate = new Date(now);
      let daysUntil = targetDay - nextDate.getDay();
      if (daysUntil <= 0) daysUntil += 7;
      nextDate.setDate(nextDate.getDate() + daysUntil);
      break;
    case 'MONTHLY':
      const targetDate = parseInt(periodValue) || 1;
      nextDate = new Date(now.getFullYear(), now.getMonth(), targetDate);
      if (nextDate <= now) nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      nextDate.setDate(nextDate.getDate() + 7);
  }
  return nextDate;
}

// 🎲 สุ่มเลือกผู้ชนะและปิดงวดทันที
function randomSelectBidder(data) {
  if(!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
    return responseJSON({ status: 'error', message: 'No Permission' });
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const circleId = String(data.circle_id);
  const period = parseInt(data.period);
  
  // 1. Get circle info
  const cSheet = ss.getSheetByName('Circles');
  const cRows = cSheet.getDataRange().getValues();
  let minBid = 0;
  let circleRowNum = -1;
  for (let i = 1; i < cRows.length; i++) {
    if (String(cRows[i][0]) === circleId) {
      minBid = parseInt(cRows[i][19]) || 0;
      circleRowNum = i + 1;
      break;
    }
  }
  
  // 2. Check if already has bids this period
  const bSheet = ss.getSheetByName('Bids');
  const bRows = bSheet.getDataRange().getValues();
  for (let i = 1; i < bRows.length; i++) {
    if (String(bRows[i][0]) === circleId && parseInt(bRows[i][1]) === period) {
      return responseJSON({ status: 'error', message: 'งวดนี้มีคนเปียแล้ว ไม่สามารถสุ่มได้' });
    }
  }
  
  // 3. Get eligible players (LIVE status)
  const pSheet = ss.getSheetByName('CirclePlayers');
  const pRows = pSheet.getDataRange().getValues();
  const eligiblePlayers = [];
  
  for (let i = 1; i < pRows.length; i++) {
    if (String(pRows[i][0]) === circleId && pRows[i][4] === 'LIVE') {
      eligiblePlayers.push({
        member_id: String(pRows[i][2]),
        name: pRows[i][3],
        hand_no: parseInt(pRows[i][1]),
        row_num: i + 1
      });
    }
  }
  
  if (eligiblePlayers.length === 0) {
    return responseJSON({ status: 'error', message: 'ไม่มีคนที่ยังไม่ได้เปีย' });
  }
  
  // 4. Random select winner
  const randomIndex = Math.floor(Math.random() * eligiblePlayers.length);
  const winner = eligiblePlayers[randomIndex];
  
  // 5. Add bid record (as winner)
  bSheet.appendRow([circleId, period, winner.member_id, minBid, new Date()]);
  
  // 6. Update winner status to DEAD
  pSheet.getRange(winner.row_num, 5).setValue('DEAD');
  
  // 7. Update circle to next period (close current period)
  if (circleRowNum > 0) {
    cSheet.getRange(circleRowNum, 11).setValue(period + 1); // K = current_period
  }
  
  // 8. Send notification
  sendLineMessage(`🎲 สุ่มผู้ชนะงวดที่ ${period}!\nวง: ${circleId}\n👤 ${winner.name} (มือ ${winner.hand_no})\n💰 ดอก: ${minBid} บาท\n✅ งวดถูกปิดแล้ว`);
  
  return responseJSON({ 
    status: 'success', 
    message: `${winner.name} ชนะงวด ${period} ด้วยดอก ${minBid} บาท`,
    selected: winner
  });
}

function getCircles(data) {
  const circles = [];
  const cSheet = getSheet('Circles');
  const cData = cSheet.getDataRange().getValues();

  // Security Check
  const memSheet = getSheet('Members');
  const memRows = memSheet.getDataRange().getValues();
  let isCallerActive = false;
  for(let m=1; m<memRows.length; m++) {
      if(memRows[m][0] == data.member_id) { 
          if(memRows[m][8] === 'ACTIVE') isCallerActive = true;
          break;
      }
  }
  if(!isCallerActive) return responseJSON({ status: 'error', message: 'รอการอนุมัติจากแอดมินก่อนครับ' });

  // Filter
  const pSheet = getSheet('CirclePlayers');
  const pData = pSheet.getDataRange().getValues();
  const myJoinedCircles = [];
  for(let i=1; i<pData.length; i++) {
      if(pData[i][2] == data.member_id) myJoinedCircles.push(pData[i][0]); 
  }

  for (let i = 1; i < cData.length; i++) {
      let cId = cData[i][0];
      let status = cData[i][7];
      if(status === 'OPEN' || myJoinedCircles.includes(cId)) {
          circles.push({ id: cId, name: cData[i][1], type: cData[i][2], total: cData[i][3], hand: cData[i][4], hands_count: cData[i][5], start: cData[i][6], status: status });
      }
  }
  circles.reverse();
  return responseJSON({ status: 'success', circles: circles });
}

// 🔴🔴🔴 FIXED: คำนวณยอดเงินตามประวัติ (History Logic) 🔴🔴🔴
function getCircleDetail(data) { 
    const ss = SpreadsheetApp.getActiveSpreadsheet(); 
    const targetId = String(data.circle_id).trim(); 
    
    // 1. Circle Info
    const cSheet = ss.getSheetByName('Circles'); 
    const circles = cSheet.getDataRange().getValues(); 
    let circle = null; 
    for(let i=1; i<circles.length; i++) { 
        if(String(circles[i][0]).trim() === targetId) { 
            let c = circles[i]; 
            let curP = parseInt(c[10]); 
            if(isNaN(curP)) curP = 1; 
            
            let reqViewP = parseInt(data.view_period);
            let viewP = (isNaN(reqViewP) || reqViewP === 0) ? curP : reqViewP;

            circle = { 
                id: c[0], name: c[1], type: c[2], total: c[3], hand: c[4], total_hands: c[5], start: c[6], status: c[7], 
                current_period: curP, 
                view_period: viewP,
                // Period Settings (columns L-X)
                period_type: c[11] || 'WEEKLY',
                period_value: c[12] || 'MON',
                period_extra: c[13] || '',
                period_interval: c[14] || 7,
                bid_start_time: formatTimeCell(c[15], '12:00'),
                bid_end_time: formatTimeCell(c[16], '18:00'),
                notify_hours: c[17] || 24,
                notify_message: c[18] || '',
                min_bid: c[19] || 0,
                max_bid: c[20] || 500,
                close_mode: c[21] || 'MANUAL',
                auto_action: c[22] || 'NOTIFY',
                next_period_date: c[23] || null
            };  
            break; 
        } 
    } 
    if(!circle) return responseJSON({ status: 'error', message: 'ไม่พบวงแชร์ ID: ' + targetId }); 
    
    // 2. Members Map & Admin Bank
    const mSheet = ss.getSheetByName('Members'); const mData = mSheet.getDataRange().getValues(); const membersMap = {}; 
    let adminBank = "ไม่พบข้อมูล";

    for(let i=1; i<mData.length; i++) {
        membersMap[String(mData[i][0]).trim()] = { name: mData[i][1], nickname: mData[i][2] };
        
        // หาเลขบัญชีคนที่เป็น SUPERADMIN
        if (mData[i][7] === 'SUPERADMIN' || String(mData[i][0]) === ADMIN_USER_ID) {
            adminBank = mData[i][5] + " (" + mData[i][1] + ")"; 
        }
    }
    
    // 3. ✨ Scan Winner History (หาประวัติผู้ชนะย้อนหลัง)
    const bSheet = getSheet('Bids'); 
    const bData = bSheet.getDataRange().getValues();
    const winnerHistory = {}; // เก็บว่าใครชนะงวดไหน { "M001": 1, "M005": 2 }
    
    // วนลูปตั้งแต่งวดที่ 1 ถึงงวดปัจจุบัน
    for (let p = 1; p < circle.current_period; p++) {
        let maxBid = -1;
        let winner = null;
        for(let i=1; i<bData.length; i++) {
            if(String(bData[i][0]) === targetId && parseInt(bData[i][1]) === p) {
                let bid = parseFloat(bData[i][3]);
                if(bid > maxBid) { 
                    maxBid = bid; 
                    winner = String(bData[i][2]); 
                }
            }
        }
        if(winner && !winnerHistory[winner]) {
            winnerHistory[winner] = p; // บันทึกว่างวด p ผู้ชนะคือคนนี้
        }
    }

    // 4. Players & Calculate Payments
    const pSheet = getSheet('CirclePlayers'); 
    const players = []; 
    const pData = pSheet.getDataRange().getValues(); 
    const memberToHandMap = {}; 

    for(let i=1; i<pData.length; i++) { 
        if(String(pData[i][0]).trim() === targetId) { 
            let mId = String(pData[i][2]).trim(); 
            let hNo = parseInt(pData[i][1]); 
            let currentStatus = pData[i][4]; // สถานะปัจจุบัน (อาจเป็น DEAD)
            let interest = parseFloat(pData[i][5]) || 0; // ดอกเบี้ยที่เขาเคยเปียได้
            let basePay = parseFloat(circle.hand);
            
            // 🔥 Logic คำนวณเงิน: อิงตามงวดที่กำลังดู (view_period)
            let mustPay = basePay;
            
            let winPeriod = winnerHistory[mId]; // งวดที่เขาชนะจริง
            
            if (winPeriod && circle.view_period > winPeriod) {
                // ถ้าดูงวดที่เป็น อนาคต กว่าวันที่เขาชนะ -> ต้องจ่ายดอก
                mustPay += interest;
            }
            // ถ้างวดที่ดู (view_period) <= winPeriod แสดงว่าตอนนั้นเขายังไม่ชนะ หรือเพิ่งชนะ -> จ่ายแค่ต้น

            // Logic เลือกมือหลัก
            if (currentStatus === 'LIVE') { 
                if (!memberToHandMap[mId] || hNo < memberToHandMap[mId]) memberToHandMap[mId] = hNo;
            } else { 
                if (!memberToHandMap[mId]) memberToHandMap[mId] = hNo;
            }

            players.push({ 
                member_id: mId, 
                hand_no: hNo, 
                name: pData[i][3] || membersMap[mId]?.name || 'Unknown', 
                status: currentStatus, 
                interest_to_pay: interest, 
                must_pay: mustPay // 🔴 ค่าที่ถูกต้องส่งกลับไป
            }); 
        } 
    } 
    players.sort((a,b) => a.hand_no - b.hand_no);
    
    // 5. Bids (Blind Logic)
    const bids = []; 
    let targetPStr = String(circle.view_period).trim();
    let isClosed = (circle.current_period > circle.view_period);

    for(let i=1; i<bData.length; i++) { 
        let rowCircleId = String(bData[i][0]).trim();
        let rowPeriodStr = String(bData[i][1]).trim();
        let rowMemberId = String(bData[i][2]).trim();

        if(rowCircleId === targetId && rowPeriodStr === targetPStr) { 
            let rawAmount = parseFloat(bData[i][3]);
            let timestamp = bData[i][4];
            
            // Logic ซ่อนยอด
            let visibleAmount = -1; 
            if (isClosed || rowMemberId === String(data.member_id).trim()) {
                visibleAmount = rawAmount;
            }

            bids.push({ 
                member_id: rowMemberId, 
                name: membersMap[rowMemberId]?.name || 'Unknown', 
                amount: visibleAmount, 
                time: timestamp,
                hand_no: memberToHandMap[rowMemberId] || 0 
            }); 
        }
    } 
    
    if (isClosed) {
        bids.sort((a, b) => {
            if (b.amount !== a.amount) return b.amount - a.amount;
            return new Date(a.time) - new Date(b.time); 
        });
    } else {
        bids.sort((a, b) => new Date(b.time) - new Date(a.time)); 
    }

    // 6. Slips
    const sSheet = getSheet('Slips'); 
    const sData = sSheet.getDataRange().getValues();
    const slipsList = []; 
    for(let i=1; i<sData.length; i++) {
        if(String(sData[i][0]).trim() === targetId && String(sData[i][2]).trim() === targetPStr) {
             slipsList.push({ 
                 id: i + 1, // row number for approve/reject
                 member_id: String(sData[i][1]).trim(), 
                 amount: sData[i][3], 
                 image_url: sData[i][5], 
                 status: sData[i][7] || 'PENDING', 
                 hand_no: sData[i][8] || 'ALL',
                 is_cash: sData[i][9] || 'false'
             });
        }
    }

    // 7. Admin Payments (ตรวจสอบว่าจ่ายใครแล้วบ้าง)
    const apSheet = ss.getSheetByName('AdminPayments');
    const adminPayments = {};
    if (apSheet) {
        const apData = apSheet.getDataRange().getValues();
        for (let i = 1; i < apData.length; i++) {
            if (String(apData[i][1]).trim() === targetId) {
                const winnerMemberId = String(apData[i][3]).trim();
                const period = String(apData[i][4]).trim();
                const paymentId = String(apData[i][0]).trim();
                const imageUrl = apData[i][6] || '';
                const isCash = apData[i][8];
                const confirmedStatus = apData[i][10] || 'PENDING';
                adminPayments[winnerMemberId + '_' + period] = {
                    payment_id: paymentId,
                    image_url: imageUrl,
                    is_cash: isCash,
                    confirmed_status: confirmedStatus
                };
            }
        }
    }

    return responseJSON({ 
        status: 'success', 
        circle: circle, 
        players: players, 
        bids: bids,
        slips: slipsList,
        admin_bank: adminBank,
        admin_payments: adminPayments,
        winner_history: winnerHistory
    }); 
}

function joinCircle(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playerSheet = ss.getSheetByName('CirclePlayers');
  const memSheet = ss.getSheetByName('Members');

  const circleId = String(data.circle_id).trim();
  const handNo = parseInt(data.hand_no);           
  const memberId = String(data.member_id).trim(); 

  const pRows = playerSheet.getDataRange().getValues();
  for (let i = 1; i < pRows.length; i++) {
    if (String(pRows[i][0]) === circleId && parseInt(pRows[i][1]) === handNo) {
      return responseJSON({ status: 'error', message: 'มือนี้มีคนจองแล้ว' });
    }
  }

  const memRows = memSheet.getDataRange().getValues();
  let memberName = '-';
  for (let i = 1; i < memRows.length; i++) {
    if (String(memRows[i][0]) === memberId) { memberName = memRows[i][1]; break; }
  }

  playerSheet.appendRow([circleId, handNo, memberId, memberName, 'LIVE', 0, new Date()]);
  return responseJSON({ status: 'success', message: 'จองมือสำเร็จเรียบร้อย!' });
}

function submitBid(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 
  } catch (e) {
    return responseJSON({ status: 'error', message: 'ระบบกำลังทำงานหนัก กรุณาลองใหม่ในอีกสักครู่' });
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bSheet = ss.getSheetByName('Bids');
    const pSheet = ss.getSheetByName('CirclePlayers');

    // Get circle settings for min/max validation
    const cSheet = ss.getSheetByName('Circles');
    const cRows = cSheet.getDataRange().getValues();
    let minBid = 0, maxBid = 500;
    for (let i = 1; i < cRows.length; i++) {
      if (String(cRows[i][0]) === String(data.circle_id)) {
        minBid = parseInt(cRows[i][19]) || 0;
        maxBid = parseInt(cRows[i][20]) || 500;
        break;
      }
    }
    
    const bidAmount = parseFloat(data.bid_amount);
    if (isNaN(bidAmount)) {
      return responseJSON({ status: 'error', message: 'ยอดเงินดอกเบี้ยไม่ถูกต้อง' });
    }
    if (bidAmount < minBid) {
      return responseJSON({ status: 'error', message: `ดอกขั้นต่ำ ${minBid} บาท` });
    }
    if (bidAmount > maxBid) {
      return responseJSON({ status: 'error', message: `ดอกสูงสุด ${maxBid} บาท` });
    }

    // Check Eligibility
    const pRows = pSheet.getDataRange().getValues();
    let isEligible = false;
    for (let i = 1; i < pRows.length; i++) {
      if (String(pRows[i][0]) === String(data.circle_id) && String(pRows[i][2]) === String(data.member_id) && pRows[i][4] === 'LIVE') {
        isEligible = true; break;
      }
    }
    if (!isEligible) return responseJSON({ status: 'error', message: 'คุณไม่มีสิทธิ์เปีย หรือเปียครบแล้ว' });

    const bData = bSheet.getDataRange().getValues();
    let rowToUpdate = -1;

    for (let i = 1; i < bData.length; i++) {
      if (String(bData[i][0]) === String(data.circle_id) && 
          String(bData[i][1]) === String(data.period) && 
          String(bData[i][2]) === String(data.member_id)) {
        rowToUpdate = i + 1; 
        break;
      }
    }

    if (rowToUpdate > 0) {
      bSheet.getRange(rowToUpdate, 4).setValue(data.bid_amount); 
      bSheet.getRange(rowToUpdate, 5).setValue(new Date());      
    } else {
      bSheet.appendRow([data.circle_id, data.period, data.member_id, data.bid_amount, new Date()]);
    }

    const mName = getMemberName(data.member_id);
    const cName = getCircleName(data.circle_id);
    sendLineMessage(`🔨 มีคนสู้ดอก!\nวง: ${cName} (งวด ${data.period})\n💰 ยอด: ${data.bid_amount} บาท\nโดย: ${mName}`);

    return responseJSON({ status: 'success', message: 'ส่งดอกเบี้ยเรียบร้อย!' });

  } catch (e) {
    return responseJSON({ status: 'error', message: 'Error: ' + e.toString() });
  } finally {
    lock.releaseLock(); 
  }
}

// =========================================
// 3. Payment Management
// =========================================

// --- แก้ไข: รองรับการจ่ายเงินสด (ไม่ต้องแนบรูป) ---
function uploadSlip(data) { 
  try { 
    const ss = SpreadsheetApp.getActiveSpreadsheet(); 
    const sheet = getSheet('Slips'); 
    var directLink = "";

    // เช็คว่าเป็นเงินสดไหม?
    if (data.is_cash === 'true') {
        // กรณีเงินสด: ใส่รูปไอคอนแทน
        directLink = "https://cdn-icons-png.flaticon.com/512/2489/2489756.png"; 
    } else {
        // กรณีโอน: อัปโหลดรูปสลิปตามปกติ
        var contentType = data.image.substring(5, data.image.indexOf(';')); 
        var base64 = data.image.substring(data.image.indexOf(',') + 1); 
        var blob = Utilities.newBlob(Utilities.base64Decode(base64), contentType, "slip_" + new Date().getTime() + ".jpg"); 
        var folder = DriveApp.getFoldersByName("GreenShare_Slips").hasNext() ? DriveApp.getFoldersByName("GreenShare_Slips").next() : DriveApp.createFolder("GreenShare_Slips"); 
        var file = folder.createFile(blob); 
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); 
        directLink = "https://lh3.googleusercontent.com/d/" + file.getId(); 
    }
    
    let handTarget = data.hand_no ? String(data.hand_no) : 'ALL';
    
    // บันทึกข้อมูล
    sheet.appendRow([
        data.circle_id, 
        data.member_id, 
        data.period, 
        data.amount, 
        data.note || '-', 
        directLink, 
        new Date(), 
        'PENDING', 
        handTarget
    ]); 
    
    // แจ้งเตือน LINE (เปลี่ยนข้อความตามประเภท)
    let msgType = (data.is_cash === 'true') ? "💵 รับเงินสด" : "🧾 ส่งสลิป";
    sendLineMessage(`${msgType} (งวด ${data.period})\nจาก: มือ ${handTarget}\nยอด: ${data.amount}`); 
    
    return responseJSON({ status: 'success', message: 'บันทึกเรียบร้อย!' }); 
  } catch (e) { 
    return responseJSON({ status: 'error', message: 'Upload Failed: ' + e.toString() }); 
  } 
}

function getPaymentChecklist(data) {
  if(!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetId = String(data.circle_id);
  
  // 1. Get Member Names
  const pSheet = ss.getSheetByName('CirclePlayers'); 
  const pRows = pSheet.getDataRange().getValues();
  const membersNameMap = {}; 
  for(let i=1; i<pRows.length; i++) {
      if(String(pRows[i][0]) === targetId) {
          membersNameMap[String(pRows[i][2])] = pRows[i][3]; 
      }
  }

  // 2. Get ALL Pending Slips
  const sSheet = ss.getSheetByName('Slips'); 
  const sRows = sSheet.getDataRange().getValues();
  const pendingList = [];

  for(let i=1; i<sRows.length; i++) {
     if(String(sRows[i][0]) === targetId && (sRows[i][7] === 'PENDING')) {
        pendingList.push({
            member_id: String(sRows[i][1]),
            name: membersNameMap[String(sRows[i][1])] || 'Unknown',
            period: sRows[i][2], 
            amount: sRows[i][3],
            url: sRows[i][5],
            hand_no: sRows[i][8] || 'ALL',
            slip_row: i+1
        });
     }
  }
  return responseJSON({ status: 'success', checklist: pendingList });
}

function approvePayment(data) {
  if(!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  const ss = SpreadsheetApp.getActiveSpreadsheet(); 
  const sSheet = ss.getSheetByName('Slips'); 
  
  if(data.slip_row) {
      let r = parseInt(data.slip_row);
      if(r > 0) { 
          sSheet.getRange(r, 8).setValue('APPROVED'); 
          return responseJSON({ status: 'success', message: 'อนุมัติเรียบร้อย' }); 
      }
  }
  return responseJSON({ status: 'error', message: 'หาข้อมูลไม่เจอ' });
}

// --- Approve Slip from Pay Table ---
function approveSlip(data) {
  if(!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
    return responseJSON({ status: 'error', message: 'No Permission' });
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet(); 
  const sSheet = ss.getSheetByName('Slips'); 
  
  if(data.slip_id) {
    let r = parseInt(data.slip_id);
    if(r > 0) { 
      sSheet.getRange(r, 8).setValue('APPROVED'); 
      return responseJSON({ status: 'success', message: 'อนุมัติสลิปเรียบร้อย' }); 
    }
  }
  return responseJSON({ status: 'error', message: 'หาข้อมูลไม่เจอ' });
}

// --- Reject Slip from Pay Table (Delete row) ---
function rejectSlip(data) {
  if(!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) {
    return responseJSON({ status: 'error', message: 'No Permission' });
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet(); 
  const sSheet = ss.getSheetByName('Slips'); 
  
  if(data.slip_id) {
    let r = parseInt(data.slip_id);
    if(r > 1) { // ไม่ลบ header row
      sSheet.deleteRow(r); 
      return responseJSON({ status: 'success', message: 'ลบสลิปเรียบร้อย สมาชิกต้องส่งใหม่' }); 
    }
  }
  return responseJSON({ status: 'error', message: 'หาข้อมูลไม่เจอ' });
}

// =========================================
// 4. Utils & Admin Management
// =========================================

function getPendingMembers(data) { 
    if(!data.caller_role || data.caller_role === 'MEMBER') return responseJSON({ status: 'error', message: 'No permission' }); 
    const sheet = getSheet('Members'); const rows = sheet.getDataRange().getValues(); const list = []; 
    for(let i=1; i<rows.length; i++) if(rows[i][8] === 'PENDING') list.push({ id: rows[i][0], name: rows[i][1] }); 
    return responseJSON({ status: 'success', members: list }); 
}

function updateMemberStatus(data) { 
    const sheet = getSheet('Members'); const rows = sheet.getDataRange().getValues(); 
    for(let i=1; i<rows.length; i++) {
        if(rows[i][0] == data.target_member_id) { sheet.getRange(i+1, 9).setValue(data.new_status); return responseJSON({ status: 'success' }); }
    }
    return responseJSON({ status: 'error' });
}

function getAllActiveMembers(data) { 
    if(!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) return responseJSON({ status: 'error' }); 
    const sheet = getSheet('Members'); const rows = sheet.getDataRange().getValues(); const list = []; 
    for(let i=1; i<rows.length; i++) if(rows[i][8] === 'ACTIVE') list.push({ id: rows[i][0], name: rows[i][1], nickname: rows[i][2] }); 
    return responseJSON({ status: 'success', members: list }); 
}

function manageSlot(data) {
  if(!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) return responseJSON({ status: 'error' });
  const sheet = getSheet('CirclePlayers'); const rows = sheet.getDataRange().getValues();
  if(data.type === 'UNASSIGN') {
    for(let i=1; i<rows.length; i++) { if(rows[i][0] == data.circle_id && rows[i][1] == data.hand_no) { sheet.deleteRow(i + 1); return responseJSON({ status: 'success' }); } }
  }
  if(data.type === 'ASSIGN') {
    const memSheet = getSheet('Members'); const memRows = memSheet.getDataRange().getValues(); let mName = '-';
    for(let i=1; i<memRows.length; i++) if(memRows[i][0] == data.target_member_id) { mName = memRows[i][1]; break; }
    sheet.appendRow([data.circle_id, data.hand_no, data.target_member_id, mName, 'LIVE', 0, new Date()]);
    return responseJSON({ status: 'success' });
  }
}

// 🔴 แก้ไข: ส่งข้อมูล assigned_bank กลับไปด้วย
function getAllMembersForManagement(data) { 
    if(!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) return responseJSON({ status: 'error' }); 
    const sheet = getSheet('Members'); 
    const rows = sheet.getDataRange().getValues(); 
    const list = []; 
    
    // ดึงข้อมูลบัญชีธนาคารทั้งหมด
    const bankSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BankAccounts');
    const bankMap = {};
    if (bankSheet) {
        const bankData = bankSheet.getDataRange().getValues();
        for(let i=1; i<bankData.length; i++) {
            bankMap[bankData[i][0]] = {
                id: bankData[i][0],
                bank_name: bankData[i][1],
                account_number: bankData[i][2],
                account_name: bankData[i][3]
            };
        }
    }
    
    for(let i=1; i<rows.length; i++) {
        if(rows[i][8] === 'ACTIVE') {
            let assignedBankId = rows[i][9] || ''; // Column J = assigned_bank_id
            let assignedBankInfo = null;
            if (assignedBankId && bankMap[assignedBankId]) {
                assignedBankInfo = bankMap[assignedBankId];
            }
            list.push({ 
                id: rows[i][0], 
                name: rows[i][1], 
                nickname: rows[i][2],
                current_role: rows[i][7],
                assigned_bank_id: assignedBankId,
                assigned_bank: assignedBankInfo
            }); 
        }
    }
    return responseJSON({ status: 'success', members: list }); 
}

function updateUserRole(data) { 
    const sheet = getSheet('Members'); const rows = sheet.getDataRange().getValues(); 
    for(let i=1; i<rows.length; i++) {
        if(rows[i][0] == data.target_member_id) { sheet.getRange(i+1, 8).setValue(data.new_role); return responseJSON({ status: 'success' }); }
    }
    return responseJSON({ status: 'error' });
}

function closePeriod(data) {
  if (!['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const circleSheet = ss.getSheetByName('Circles'); const bidSheet = ss.getSheetByName('Bids'); const playerSheet = ss.getSheetByName('CirclePlayers'); 
  const cRows = circleSheet.getDataRange().getValues(); let cIndex = -1; let currentPeriod = 1; const targetCircleId = String(data.circle_id);
  for (let i = 1; i < cRows.length; i++) { if (String(cRows[i][0]) === targetCircleId) { cIndex = i; let val = parseInt(cRows[i][10]); if (isNaN(val)) val = 1; currentPeriod = val; break; } }
  if (cIndex === -1) return responseJSON({ status: 'error', message: 'ไม่พบวง' });

  const bRows = bidSheet.getDataRange().getValues(); let maxBid = -1; let winnerMemberId = null;
  for (let i = 1; i < bRows.length; i++) { 
      const rowCircleId = String(bRows[i][0]); const rowPeriod = parseInt(bRows[i][1]); const rowBid = parseFloat(bRows[i][3]); 
      if (rowCircleId === targetCircleId && rowPeriod === currentPeriod) { 
          if (rowBid > maxBid) { maxBid = rowBid; winnerMemberId = bRows[i][2]; } 
      } 
  }
  if (!winnerMemberId) return responseJSON({ status: 'error', message: `ไม่มีใครเปีย` });

  const pRows = playerSheet.getDataRange().getValues(); let updatedPlayer = false; 
  let targetRowIndex = -1; let minHandNo = 9999;
  for (let i = 1; i < pRows.length; i++) { 
      if (String(pRows[i][0]) === targetCircleId && String(pRows[i][2]) === String(winnerMemberId) && pRows[i][4] === 'LIVE') {
          let hNo = parseInt(pRows[i][1]);
          if (hNo < minHandNo) { minHandNo = hNo; targetRowIndex = i + 1; }
      } 
  }
  if (targetRowIndex > 0) {
      playerSheet.getRange(targetRowIndex, 5).setValue('DEAD'); 
      playerSheet.getRange(targetRowIndex, 6).setValue(maxBid); 
      updatedPlayer = true;
  }
  if (!updatedPlayer) return responseJSON({ status: 'error', message: 'ไม่พบมือว่างของผู้ชนะ' });
  circleSheet.getRange(cIndex + 1, 11).setValue(currentPeriod + 1);
  return responseJSON({ status: 'success', message: `ปิดงวดที่ ${currentPeriod} สำเร็จ!` });
}

function findNextBiddingHandCaller(data) { return responseJSON(findNextBiddingHand(data.circle_id, data.member_id)); }
function findNextBiddingHand(targetCircleId, targetMemberId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); var sheet = ss.getSheetByName("CirclePlayers"); var data = sheet.getDataRange().getValues();
  var eligibleHands = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[0]).trim() == String(targetCircleId).trim() && String(row[2]).trim() == String(targetMemberId).trim() && row[4] == 'LIVE') {
      eligibleHands.push({ hand_no: parseInt(row[1]), row_index: i + 1 });
    }
  }
  if (eligibleHands.length === 0) return { canBid: false, message: "คุณไม่มีสิทธิ์เปีย หรือเปียครบแล้ว" };
  eligibleHands.sort(function(a, b) { return a.hand_no - b.hand_no; });
  return { canBid: true, hand_no: eligibleHands[0].hand_no, message: "OK" };
}

function getMemberName(mId) { const sheet = getSheet('Members'); const rows = sheet.getDataRange().getValues(); for(let i=1; i<rows.length; i++) if(rows[i][0] == mId) return rows[i][1]; return mId; }
function getCircleName(cId) { const sheet = getSheet('Circles'); const rows = sheet.getDataRange().getValues(); for(let i=1; i<rows.length; i++) if(rows[i][0] == cId) return rows[i][1]; return cId; }
function getSheet(name) { const ss = SpreadsheetApp.getActiveSpreadsheet(); let sheet = ss.getSheetByName(name); if (!sheet) { sheet = ss.insertSheet(name); if(name=='Slips') sheet.appendRow(['circle_id','member_id','period','amount','note','url','time','status','hand_no']); if(name=='Bids') sheet.appendRow(['circle_id','period','member_id','amount','timestamp']); if(name=='CirclePlayers') sheet.appendRow(['circle_id','hand_no','member_id','name','status','interest_to_pay','joined_at']); } return sheet; }

// =========================================
// 5. Bank Account Functions
// =========================================

// ดึงข้อมูลบัญชีธนาคาร Default
function getDefaultBankAccount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BankAccounts');
  if (!sheet) {
    return responseJSON({ status: 'error', message: 'ไม่พบ Sheet BankAccounts' });
  }
  
  const data = sheet.getDataRange().getValues();
  // Columns: id, bank_name, account_number, account_name, is_default
  for (let i = 1; i < data.length; i++) {
    if (data[i][4] === true || data[i][4] === 'TRUE' || data[i][4] === 'true') {
      return responseJSON({
        status: 'success',
        bank: {
          id: data[i][0],
          bank_name: data[i][1],
          account_number: data[i][2],
          account_name: data[i][3]
        }
      });
    }
  }
  
  return responseJSON({ status: 'error', message: 'ไม่พบบัญชี Default' });
}

// ดึงบัญชีธนาคารที่ควรแสดงให้สมาชิก (ถ้า assign ไว้ใช้อันนั้น ถ้าไม่ได้ assign ใช้ default)
function getMemberBankDisplay(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const memberId = String(data.member_id || '').trim();
  
  if (!memberId) {
    return getDefaultBankAccount();
  }
  
  // หา assigned_bank_id ของ member
  const mSheet = ss.getSheetByName('Members');
  const mData = mSheet.getDataRange().getValues();
  let assignedBankId = '';
  
  for (let i = 1; i < mData.length; i++) {
    if (String(mData[i][0]).trim() === memberId) {
      assignedBankId = mData[i][9] || ''; // Column J = assigned_bank_id
      break;
    }
  }
  
  // ถ้าไม่มี assigned bank -> return default
  if (!assignedBankId) {
    return getDefaultBankAccount();
  }
  
  // หาข้อมูลบัญชีที่ assign ไว้
  const bSheet = ss.getSheetByName('BankAccounts');
  if (!bSheet) {
    return responseJSON({ status: 'error', message: 'ไม่พบ Sheet BankAccounts' });
  }
  
  const bData = bSheet.getDataRange().getValues();
  for (let i = 1; i < bData.length; i++) {
    if (String(bData[i][0]).trim() === assignedBankId) {
      return responseJSON({
        status: 'success',
        bank: {
          id: bData[i][0],
          bank_name: bData[i][1],
          account_number: bData[i][2],
          account_name: bData[i][3]
        }
      });
    }
  }
  
  // ถ้าหา assigned bank ไม่เจอ -> return default
  return getDefaultBankAccount();
}

// ดึงรายชื่อบัญชีธนาคารทั้งหมด
function getAllBankAccounts(data) {
  if(!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BankAccounts');
  if (!sheet) {
    return responseJSON({ status: 'error', message: 'ไม่พบ Sheet BankAccounts' });
  }
  
  const rows = sheet.getDataRange().getValues();
  const banks = [];
  // Columns: id, bank_name, account_number, account_name, is_default
  for (let i = 1; i < rows.length; i++) {
    banks.push({
      id: rows[i][0],
      bank_name: rows[i][1],
      account_number: rows[i][2],
      account_name: rows[i][3],
      is_default: rows[i][4] === true || rows[i][4] === 'TRUE' || rows[i][4] === 'true'
    });
  }
  
  return responseJSON({ status: 'success', banks: banks });
}

// ดึงบัญชีทั้งหมดพร้อม is_default (สำหรับ Admin Management)
function getAllBankAccountsFull(data) {
  if(!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BankAccounts');
  if (!sheet) {
    return responseJSON({ status: 'error', message: 'ไม่พบ Sheet BankAccounts' });
  }
  
  const rows = sheet.getDataRange().getValues();
  const banks = [];
  for (let i = 1; i < rows.length; i++) {
    banks.push({
      id: rows[i][0],
      bank_name: rows[i][1],
      account_number: rows[i][2],
      account_name: rows[i][3],
      is_default: rows[i][4]
    });
  }
  return responseJSON({ status: 'success', banks: banks });
}

// เพิ่มบัญชีธนาคารใหม่
function addBankAccount(data) {
  if(!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BankAccounts');
  if (!sheet) {
    return responseJSON({ status: 'error', message: 'ไม่พบ Sheet BankAccounts' });
  }
  
  const newId = 'BANK' + new Date().getTime();
  const isFirstBank = sheet.getLastRow() <= 1;
  sheet.appendRow([newId, data.bank_name, data.account_number, data.account_name, isFirstBank]);
  
  return responseJSON({ status: 'success', message: 'เพิ่มบัญชีเรียบร้อย', id: newId });
}

// แก้ไขบัญชีธนาคาร
function updateBankAccount(data) {
  if(!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BankAccounts');
  if (!sheet) {
    return responseJSON({ status: 'error', message: 'ไม่พบ Sheet BankAccounts' });
  }
  
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.bank_id).trim()) {
      sheet.getRange(i + 1, 2).setValue(data.bank_name);
      sheet.getRange(i + 1, 3).setValue(data.account_number);
      sheet.getRange(i + 1, 4).setValue(data.account_name);
      return responseJSON({ status: 'success', message: 'แก้ไขเรียบร้อย' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบบัญชี' });
}

// ลบบัญชีธนาคาร
function deleteBankAccount(data) {
  if(!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BankAccounts');
  if (!sheet) {
    return responseJSON({ status: 'error', message: 'ไม่พบ Sheet BankAccounts' });
  }
  
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.bank_id).trim()) {
      sheet.deleteRow(i + 1);
      return responseJSON({ status: 'success', message: 'ลบเรียบร้อย' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบบัญชี' });
}

// ตั้งบัญชีเป็น Default
function setDefaultBankAccount(data) {
  if(!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BankAccounts');
  if (!sheet) {
    return responseJSON({ status: 'error', message: 'ไม่พบ Sheet BankAccounts' });
  }
  
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    sheet.getRange(i + 1, 5).setValue(false);
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.bank_id).trim()) {
      sheet.getRange(i + 1, 5).setValue(true);
      return responseJSON({ status: 'success', message: 'ตั้งบัญชีหลักเรียบร้อย' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบบัญชี' });
}

// กำหนดบัญชีธนาคารให้สมาชิก
function assignMemberBank(data) {
  if(!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) return responseJSON({ status: 'error', message: 'No Permission' });
  
  const sheet = getSheet('Members');
  const rows = sheet.getDataRange().getValues();
  
  for(let i=1; i<rows.length; i++) {
    if(rows[i][0] == data.target_member_id) {
      // Column J (10) = assigned_bank_id
      sheet.getRange(i+1, 10).setValue(data.bank_id || '');
      return responseJSON({ status: 'success', message: 'กำหนดบัญชีเรียบร้อย' });
    }
  }
  
  return responseJSON({ status: 'error', message: 'ไม่พบข้อมูลสมาชิก' });
}

function generateNextId(sheet, p) { const lastRow = sheet.getLastRow(); if (lastRow <= 1) return p + "0001"; const lastId = sheet.getRange(lastRow, 1).getValue(); const num = parseInt(lastId.replace(p, "")) + 1; return p + ("0000" + num).slice(-4); }

// ดึงข้อมูลบัญชีธนาคารส่วนตัวของสมาชิก (สำหรับ Admin จ่ายเงินให้)
function getMemberBankInfo(data) {
  const sheet = getSheet('Members');
  const rows = sheet.getDataRange().getValues();
  
  for(let i=1; i<rows.length; i++) {
    if(rows[i][0] == data.member_id) {
      const bankAccount = rows[i][5] || '';
      return responseJSON({ status: 'success', bank_account: bankAccount });
    }
  }
  
  return responseJSON({ status: 'error', message: 'ไม่พบข้อมูลสมาชิก' });
}

// Admin จ่ายเงินให้ผู้ชนะการประมูล
function adminPayWinner(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('AdminPayments');
    
    if (!sheet) {
      sheet = ss.insertSheet('AdminPayments');
      sheet.appendRow(['id', 'circle_id', 'admin_id', 'winner_member_id', 'period', 'amount', 'image_url', 'note', 'is_cash', 'created_at', 'confirmed_status']);
    }
    
    let imageUrl = '';
    if (data.image && data.image.length > 0) {
      const folder = DriveApp.getRootFolder();
      const base64Data = data.image.split(',')[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/png', 'admin_pay_' + Date.now() + '.png');
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
      imageUrl = file.getUrl();
    }
    
    const newId = 'APAY' + new Date().getTime();
    sheet.appendRow([newId, data.circle_id, data.admin_id, data.winner_member_id, data.period, data.amount, imageUrl, data.note || '', data.is_cash, new Date(), 'PENDING']);
    
    return responseJSON({ status: 'success', message: 'บันทึกการจ่ายเงินเรียบร้อย' });
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

// สมาชิกยืนยันว่าได้รับเงินจาก Admin แล้ว
function confirmAdminPayment(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('AdminPayments');
    if (!sheet) return responseJSON({ status: 'error', message: 'ไม่พบข้อมูล' });
    
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === data.payment_id) {
        sheet.getRange(i + 1, 11).setValue('CONFIRMED');
        return responseJSON({ status: 'success', message: 'ยืนยันรับเงินเรียบร้อย' });
      }
    }
    return responseJSON({ status: 'error', message: 'ไม่พบรายการชำระเงิน' });
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

// สมาชิกแจ้งว่ายังไม่ได้รับเงิน - ลบรายการการจ่าย
function rejectAdminPayment(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('AdminPayments');
    if (!sheet) return responseJSON({ status: 'error', message: 'ไม่พบข้อมูล' });
    
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === data.payment_id) {
        sheet.deleteRow(i + 1);
        return responseJSON({ status: 'success', message: 'ลบรายการชำระเงินเรียบร้อย' });
      }
    }
    return responseJSON({ status: 'error', message: 'ไม่พบรายการชำระเงิน' });
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

// ⚙️ แก้ไข settings ของวง (เฉพาะบางค่าที่อนุญาต)
function updateCircleSettings(data) {
  if(!['SUPERADMIN', 'ADMIN'].includes(data.caller_role)) {
    return responseJSON({ status: 'error', message: 'No Permission' });
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Circles');
  const rows = sheet.getDataRange().getValues();
  const circleId = String(data.circle_id);
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === circleId) {
      const rowNum = i + 1;
      
      // Update fields (ใช้ค่า default ถ้าว่าง)
      sheet.getRange(rowNum, 16).setValue(data.bid_start_time || '12:00');  // P
      sheet.getRange(rowNum, 17).setValue(data.bid_end_time || '18:00');    // Q
      sheet.getRange(rowNum, 18).setValue(parseInt(data.notify_hours) || 24); // R
      if (data.notify_message !== undefined) sheet.getRange(rowNum, 19).setValue(data.notify_message); // S
      sheet.getRange(rowNum, 20).setValue(parseInt(data.min_bid) || 0);     // T - เพิ่มใหม่
      sheet.getRange(rowNum, 21).setValue(parseInt(data.max_bid) || 500);   // U - เพิ่มใหม่
      sheet.getRange(rowNum, 22).setValue(data.close_mode || 'MANUAL');     // V
      sheet.getRange(rowNum, 23).setValue(data.auto_action || 'NOTIFY');    // W
      
      return responseJSON({ status: 'success', message: 'อัปเดตการตั้งค่าเรียบร้อย' });
    }
  }
  
  return responseJSON({ status: 'error', message: 'ไม่พบวงแชร์' });
}

// แปลงค่าเวลาจาก Sheet ให้เป็น HH:MM format
function formatTimeCell(val, defaultVal) {
  if (!val) return defaultVal;
  // ถ้าเป็น string "HH:MM" อยู่แล้ว
  if (typeof val === 'string' && val.match(/^\d{1,2}:\d{2}/)) {
    return val.substring(0, 5);
  }
  // ถ้าเป็น Date object
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Bangkok', 'HH:mm');
  }
  // ถ้าเป็นตัวเลข decimal (0.5 = 12:00)
  if (typeof val === 'number' && val < 1) {
    const hours = Math.floor(val * 24);
    const mins = Math.round((val * 24 - hours) * 60);
    return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
  }
  return defaultVal;
}