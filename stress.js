// Green Timer Stress Test Logic
const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');

// Apply Red Mode branding to test bench
document.body.style.borderColor = '#ff3b3b';
document.querySelector('h1').innerHTML += ' <span style="color:#ff3b3b; font-size:0.5em;">(RED MODE)</span>';
document.getElementById('generateBtn').style.borderColor = '#ff3b3b';
document.getElementById('generateBtn').style.color = '#ff3b3b';
document.querySelectorAll('input').forEach(i => i.style.borderColor = '#ff3b3b');

function log(msg) {
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.prepend(div);
}

document.getElementById('clearBtn').onclick = () => {
    if(confirm('Clear all extension data?')) {
        chrome.storage.local.get(null, (allData) => {
            const toRemove = Object.keys(allData).filter(k => k.startsWith('dev_'));
            chrome.storage.local.remove(toRemove, () => {
                log('Dev storage cleared.');
                statusEl.textContent = 'Dev Storage Empty.';
            });
        });
    }
};

document.getElementById('generateBtn').onclick = () => {
    const numProblems = parseInt(document.getElementById('probCount').value);
    const subsPerProb = parseInt(document.getElementById('subCount').value);
    const totalEntries = numProblems * subsPerProb;

    statusEl.textContent = `Generating ${totalEntries} entries...`;
    log(`Starting generation of ${numProblems} problems...`);

    const tags = ['Array', 'String', 'DP', 'Math', 'Tree', 'Graph', 'Sorting', 'Greedy', 'Bitmask'];
    const diffs = ['Easy', 'Medium', 'Hard'];
    const statuses = ['Solved Independently', 'Struggled', 'Mastered', 'Needs Revision'];

    const leetcode_history = [];
    const problem_metadata = {};

    const startTime = performance.now();

    for (let i = 1; i <= numProblems; i++) {
        const probTags = [tags[Math.floor(Math.random() * tags.length)], tags[Math.floor(Math.random() * tags.length)]];
        const uniqueTags = [...new Set(probTags)];
        
        const problem = {
            name: `Stress Test Problem ${i}`,
            number: `${i}`,
            url: `https://leetcode.com/problems/stress-test-${i}/`,
            difficulty: diffs[Math.floor(Math.random() * diffs.length)],
            tags: uniqueTags,
            submissions: []
        };

        for (let j = 0; j < subsPerProb; j++) {
            const ts = Date.now() - (Math.random() * 10000000000); // Random time in last ~4 months
            const randomMs = Math.floor(Math.random() * 3600000) + 60000; // 1 min to 60 mins
            
            // Format time string manually for stress test
            let s = Math.floor(randomMs / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
            s %= 60; m %= 60;
            const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.00`;

            problem.submissions.push({
                status: statuses[Math.floor(Math.random() * statuses.length)],
                timeStr: timeStr,
                elapsedMs: randomMs,
                timestamp: ts,
                notes: `System generated stress test note for problem ${i} submission ${j}`
            });
        }

        // Sort submissions newest first
        problem.submissions.sort((a,b) => b.timestamp - a.timestamp);
        leetcode_history.push(problem);
        
        // Sync metadata
        problem_metadata[`${i}`] = { tags: uniqueTags };
    }

    const endTime = performance.now();
    log(`Generation complete in ${(endTime - startTime).toFixed(2)}ms.`);
    
    statusEl.textContent = 'Injecting into Chrome Storage...';
    
    const storageData = {
        dev_leetcode_history: leetcode_history,
        dev_problem_metadata: problem_metadata,
        dev_global_tags: tags
    };

    chrome.storage.local.set(storageData, () => {
        log('SUCCESS: 15,000 entries injected.');
        statusEl.textContent = `Done! Total: ${totalEntries} entries stored.`;
        log('Now open the extension and check History/Stats/Analytics tabs.');
    });
};
