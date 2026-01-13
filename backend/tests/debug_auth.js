import readline from 'readline';
import admin from '../src/lib/firebaseAdmin.js';
import authenticateToken from '../src/middleware/auth.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const auth = admin.auth();

// Mock response object
const createMockRes = () => {
    return {
        status: function (code) {
            this.statusCode = code;
            return this;
        },
        json: function (data) {
            this.body = data;
            console.log(`\n[Response ${this.statusCode || 200}]`, JSON.stringify(data, null, 2));
            return this;
        },
        statusCode: 200,
        body: null
    };
};

// Mock next function
const next = () => {
    console.log('\n✅ Middleware passed: next() called');
};

const showMenu = () => {
    console.log('\n--- Auth Debugger Test Script ---');
    console.log('1. Test Google Sign-in (Simulated or Real Token)');
    console.log('2. Test GitHub Sign-in (Simulated or Real Token)');
    console.log('3. Test Sign-out / Invalid Auth');
    console.log('4. Exit');
    rl.question('\nChoose an option: ', handleChoice);
};

const runTest = async (token, provider = 'unknown') => {
    const req = {
        headers: {
            'authorization': token ? `Bearer ${token}` : undefined
        },
        user: null
    };
    const res = createMockRes();

    console.log('\n--- Running Middleware Test ---');

    // The middleware itself logs authHeader and idToken
    // We will capture decodedToken from req.user after it runs

    try {
        await authenticateToken(req, res, () => {
            next();
            if (req.user) {
                console.log('1. authHeader:', req.headers['authorization']);
                console.log('2. idToken:', token);
                console.log('3. decodedToken (from req.user):', JSON.stringify(req.user, null, 2));
            }
        });
    } catch (err) {
        console.error('Error during test execution:', err);
    }

    showMenu();
};

const handleTokenInput = (provider) => {
    rl.question(`Enter a real ${provider} ID token (or press Enter to use a MOCK token): `, (token) => {
        if (!token) {
            console.log(`Using a MOCK token for ${provider}...`);
            // Note: Since the middleware calls verifyIdToken, real verification will fail with a mock token.
            // In a real debug scenario, verifyIdToken would be mocked or a real token used.
            // For this script, we'll try verification and if it fails, we show the error.
            token = `mock-token-${provider}-${Date.now()}`;
        }
        runTest(token, provider);
    });
};

const handleChoice = (choice) => {
    switch (choice) {
        case '1':
            handleTokenInput('Google');
            break;
        case '2':
            handleTokenInput('GitHub');
            break;
        case '3':
            console.log('Simulating Sign-out / Invalid state...');
            runTest(null);
            break;
        case '4':
            console.log('Exiting...');
            rl.close();
            process.exit(0);
        default:
            console.log('Invalid choice. Try again.');
            showMenu();
            break;
    }
};

showMenu();
