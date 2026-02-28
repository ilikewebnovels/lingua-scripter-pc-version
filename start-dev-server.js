import { spawn } from 'child_process';
import os from 'os';

const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// --- Helper function to run a command and wait for it to complete ---
function runCommand(command, args, name) {
    return new Promise((resolve, reject) => {
        console.log(`${CYAN}Running ${name}...${RESET}`);
        const child = spawn(command, args, { stdio: 'inherit', shell: true });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`${GREEN}${name} completed successfully.${RESET}\n`);
                resolve();
            } else {
                console.error(`${YELLOW}${name} failed with code ${code}.${RESET}`);
                reject(new Error(`${name} failed.`));
            }
        });

        child.on('error', (err) => {
            console.error(`${YELLOW}Failed to start ${name}: ${err.message}${RESET}`);
            reject(err);
        });
    });
}

// --- Helper function to run a long-running process ---
function runProcess(command, args, name, color, onData) {
    const prefix = `${color}[${name.toUpperCase()}]${RESET} `;
    const child = spawn(command, args, { shell: true });
    
    let buffer = '';

    child.stdout.on('data', (data) => {
        const chunk = data.toString();
        buffer += chunk;
        if (onData) onData(buffer); // Pass the accumulated buffer
        // Also log the immediate chunk to the console
        process.stdout.write(prefix + chunk.replace(/\n/g, `\n${prefix}`) );
    });

    child.stderr.on('data', (data) => {
        process.stderr.write(prefix + data.toString().replace(/\n/g, `\n${prefix}`) );
    });

    child.on('close', (code) => {
        console.log(`${YELLOW}${name} process exited with code ${code}.${RESET}`);
    });

    return child;
}

// --- Helper function to open URL in browser ---
function openUrl(url) {
    console.log(`${CYAN}Attempting to open URL: ${url}${RESET}`);
    const platform = os.platform();
    let command;
    switch (platform) {
        case 'win32':
            command = 'start';
            break;
        case 'darwin':
            command = 'open';
            break;
        default:
            command = 'xdg-open';
            break;
    }
    try {
        spawn(command, [url], { shell: true, detached: true });
        console.log(`${GREEN}Successfully launched browser command for ${url}.${RESET}`);
    } catch(e) {
        console.error(`${YELLOW}Failed to open browser automatically: ${e.message}${RESET}`);
        console.error(`${YELLOW}Please open this URL in your browser manually: ${url}${RESET}`);
    }
}

// --- Main script execution ---
async function main() {
    try {
        // Step 1: Install dependencies
        await runCommand('npm', ['install'], 'npm install');

        // Step 2: Start backend and frontend servers
        console.log(`${CYAN}Starting backend and frontend servers...${RESET}`);
        
        const backend = runProcess('npm', ['start'], 'backend', BLUE);
        
        let urlOpened = false;
        const frontend = runProcess('npm', ['run', 'dev'], 'frontend', GREEN, (data) => {
            if (!urlOpened) {
                const match = data.match(/(http:\/\/localhost:\d+)/);
                if (match && match[1]) {
                    const url = match[1];
                    // Add a small delay to ensure the server is fully ready
                    setTimeout(() => openUrl(url), 1000);
                    urlOpened = true; // Set to true to prevent multiple openings
                }
            }
        });

        // Graceful shutdown
        const cleanup = () => {
            console.log(`\n${YELLOW}Shutting down servers...${RESET}`);
            if (backend) backend.kill();
            if (frontend) frontend.kill();
            process.exit();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

    } catch (error) {
        console.error(`${YELLOW}\nSetup failed. Please check the errors above.${RESET}`);
        process.exit(1);
    }
}

main();