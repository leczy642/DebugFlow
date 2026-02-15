
import { v4 as uuid } from 'uuid';

// Mock data setup
const msg1 = { id: 'msg-1', role: 'user', content: 'Hi', parentId: null };
const msg2 = { id: 'msg-2', role: 'assistant', content: 'Hello!', parentId: 'msg-1' };
const msg3 = { id: 'msg-3', role: 'user', content: 'My name is Alex', parentId: 'msg-2' };
const msg4 = { id: 'msg-4', role: 'assistant', content: 'Nice to meet you, Alex.', parentId: 'msg-3' };
const msg5 = { id: 'msg-5', role: 'user', content: 'What is my name?', parentId: 'msg-4' };

const allMessages = [msg1, msg2, msg3, msg4, msg5];
const msgMap = new Map(allMessages.map((m) => [m.id, m]));

// Simulate chat.js logic
function reconstructHistory(parentId) {
    const history = [];
    let currentId = parentId;

    // console.log(`Reconstructing history from parentId: ${parentId}`);

    while (currentId) {
        const msg = msgMap.get(currentId);
        if (!msg) break;

        // Simulating "isDeleted" check (assuming false)
        history.unshift({ role: msg.role, content: msg.content });
        currentId = msg.parentId;
    }

    // In chat.js, the CURRENT message is pushed manually, so history contains ONLY previous messages here.
    return history;
}

function truncate(str) {
    return str.length > 20 ? str.substring(0, 20) + '...' : str;
}

// Scenario 1: User asks "What is my name?" (msg5). 
// The parentId received by backend would be 'msg-4' (the last assistant message).
const history1 = reconstructHistory('msg-4');

console.log('--- Scenario 1: Normal Follow-up ---');
console.log('Expected Order: Hi, Hello!, My name is Alex, Nice to meet you, Alex.');
console.log('Actual Order:', history1.map(m => truncate(m.content)));

if (history1.length === 4 && history1[3].content === msg4.content && history1[0].content === msg1.content) {
    console.log('PASSED\n');
} else {
    console.log('FAILED\n');
}


// Scenario 2: New Conversation Branch
// User replies to msg2 ("Hello!") instead of msg4.
// ParentId = 'msg-2'.
const history2 = reconstructHistory('msg-2');

console.log('--- Scenario 2: Branching from msg-2 ---');
console.log('Expected Order: Hi, Hello!');
console.log('Actual Order:', history2.map(m => truncate(m.content)));

if (history2.length === 2 && history2[1].content === msg2.content) {
    console.log('PASSED\n');
} else {
    console.log('FAILED\n');
}

// Scenario 3: Continuation (Backend Logic Simulation)
// Backend logic:
// if (req.body.isContinuation) { currentId = userMessageId; ... }
// We need to simulate the 'userMessageId' finding logic too.
// "Find the last assistant message in this session to continue from"
const lastAssistantMsg = allMessages.filter(m => m.role === 'assistant').pop(); // msg4
const userMessageId = lastAssistantMsg.id; // msg4

function reconstructContinuation(aiMessageId) {
    const history = [];
    let currentId = aiMessageId;

    while (currentId) {
        const msg = msgMap.get(currentId);
        if (!msg) break;
        history.unshift({ role: msg.role, content: msg.content });
        currentId = msg.parentId;
    }

    history.push({
        role: "user",
        content: "Continue your previous response..."
    });

    return history;
}

const history3 = reconstructContinuation('msg-4');
console.log('--- Scenario 3: Continuation from msg-4 ---');
console.log('Expected Order: Hi, Hello!, My name is Alex, Nice to meet you, Alex., Continue...');
console.log('Actual Order:', history3.map(m => truncate(m.content)));

if (history3.length === 5 && history3[3].content === msg4.content) {
    console.log('PASSED\n');
} else {
    console.log('FAILED\n');
}
