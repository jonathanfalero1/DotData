/*
	ZeroFour by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

(function($) {

	var	$window = $(window),
		$body = $('body');

	// Breakpoints.
		breakpoints({
			xlarge:  [ '1281px',  '1680px' ],
			large:   [ '981px',   '1280px' ],
			medium:  [ '737px',   '980px'  ],
			small:   [ null,      '736px'  ]
		});

	// Play initial animations on page load.
		$window.on('load', function() {
			window.setTimeout(function() {
				$body.removeClass('is-preload');
			}, 100);
		});

	// Dropdowns.
		$('#nav > ul').dropotron({
			offsetY: -22,
			mode: 'fade',
			noOpenerFade: true,
			speed: 300,
			detach: false
		});

	// Nav.

		// Title Bar.
			$(
				'<div id="titleBar">' +
					'<a href="#navPanel" class="toggle"></a>' +
					'<span class="title">' + $('#logo').html() + '</span>' +
				'</div>'
			)
				.appendTo($body);

		// Panel.
			$(
				'<div id="navPanel">' +
					'<nav>' +
						$('#nav').navList() +
					'</nav>' +
				'</div>'
			)
				.appendTo($body)
				.panel({
					delay: 500,
					hideOnClick: true,
					hideOnSwipe: true,
					resetScroll: true,
					resetForms: true,
					side: 'left',
					target: $body,
					visibleClass: 'navPanel-visible'
				});

})(jQuery);



const SERVER = "http://localhost:8000";

const forms = [
{ number: 'I-130', label: 'I-130 — Petition for Alien Relative'},
{ number: 'I-485', label: 'I-485 — Application to Register Permanent Residence or Adjust Status'},
{ number: 'I-129', label: 'I-129 — Petition for Nonimmigrant Worker'},
{ number: 'I-131', label: 'I-131 — Application for Travel Document'},
{ number: 'I-140', label: 'I-140 — Immigrant Petition for Alien Workers'},
{ number: 'I-360', label: 'I-360 — Petition for Amerasian, Widow(er), or Special Immigrant'},
{ number: 'I-526', label: 'I-526 — Immigrant Petition by Alien Investor'},
{ number: 'I-539', label: 'I-539 — Application to Extend/Change Nonimmigrant Status'},
{ number: 'I-600', label: 'I-600 — Petition to Classify Orphan as an Immediate Relative'},
{ number: 'I-601', label: 'I-601 — Application for Waiver of Grounds of Inadmissibility'},
{ number: 'I-751', label: 'I-751 — Petition to Remove Conditions on Residence'},
{ number: 'I-765', label: 'I-765 — Application for Employment Authorization'},
{ number: 'I-800', label: 'I-800 — Petition to Classify Convention Adoptee as an Immediate Relative'},
{ number: 'I-821', label: 'I-821 — Application for Temporary Protected Status'},
{ number: 'I-821D', label: 'I-821D — Consideration of Deferred Action for Childhood Arrivals (DACA)'},
{ number: 'I-864', label: 'I-864 — Affidavit of Support'},
{ number: 'I-90', label: 'I-90 — Application to Replace Permanent Resident Card'},
{ number: 'I-914', label: 'I-914 — Application for T Nonimmigrant Status'},
{ number: 'I-918', label: 'I-918 — Petition for U Nonimmigrant Status'},
{ number: 'N-400', label: 'N-400 — Application for Naturalization'},
{ number: 'N-600', label: 'N-600 — Application for Certificate of Citizenship'},
{ number: 'N-565', label: 'N-565 — Application for Replacement Naturalization/Citizenship Document'}
]

const input   = document.getElementById('search-box');
const matches = document.getElementById('matches');

input.addEventListener('input', function() {
  const query = this.value.toLowerCase();
  matches.innerHTML = '';
  if (!query) { matches.style.display = 'none'; return; }

  const filtered = forms.filter(f => f.label.toLowerCase().includes(query));
  if (filtered.length > 0) {
    matches.style.display = 'block';
    filtered.forEach(f => {
      const div = document.createElement('div');
      div.classList.add('matches-item');
      div.textContent = f.label;         
      div.addEventListener('click', () => {
        input.value = f.label;          
        input.dataset.number = f.number; 
        matches.style.display = 'none';
        submitForm();
      });
      matches.appendChild(div);
    });
  } else {
    matches.style.display = 'none';
  }
});


function submitForm() {
    const formNumber = input.dataset.number || input.value.trim().split(' ')[0];
    if (!formNumber) return;
    sendPrompt(formNumber);
	predict();
}

async function sendPrompt(formNumber) {
    const whatBox   = document.getElementById('ai-what');
    const stepsBox  = document.getElementById('ai-steps');
    const rightsBox = document.getElementById('ai-rights');
    const model     = "meta-llama/Llama-3.1-8B-Instruct:cerebras";

    [whatBox, stepsBox, rightsBox].forEach(box => {
        if (box) box.innerHTML = '<p style="color:#aaa; font-style:italic;">Loading...</p>';
    });

    let fullText = "";

    try {
        const res = await fetch(`${SERVER}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: formNumber, model }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `Server error ${res.status}`);
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
            for (const line of lines) {
                const payload = JSON.parse(line.slice(6));
                if (payload.error) throw new Error(payload.error);
                fullText += payload.token;
                updateSections(fullText);
            }
        }

    } catch (err) {
        const msg = err.message.includes("Failed to fetch")
            ? "Cannot connect — make sure server.py is running"
            : err.message;
        [whatBox, stepsBox, rightsBox].forEach(box => {
            if (box) box.innerHTML = `<p style="color:red;">❌ ${msg}</p>`;
        });
    }
}

function updateSections(text) {
    const whatBox   = document.getElementById('ai-what');
    const stepsBox  = document.getElementById('ai-steps');
    const rightsBox = document.getElementById('ai-rights');

    const whatMatch   = text.match(/\*\*WHAT IT IS\*\*([\s\S]*?)(?=\*\*HOW TO FILE\*\*|$)/);
    const stepsMatch  = text.match(/\*\*HOW TO FILE\*\*([\s\S]*?)(?=\*\*KNOW YOUR RIGHTS\*\*|$)/);
    const rightsMatch = text.match(/\*\*KNOW YOUR RIGHTS\*\*([\s\S]*?)$/);

    if (whatBox   && whatMatch)   whatBox.innerHTML   = formatSentences(whatMatch[1].trim());
    if (stepsBox  && stepsMatch)  stepsBox.innerHTML  = formatSentences(stepsMatch[1].trim());
    if (rightsBox && rightsMatch) rightsBox.innerHTML = formatSentences(rightsMatch[1].trim());
}

function formatSentences(text) {
    // Split on sentence endings and wrap each in its own <p>
    return text
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0)
        .map(s => `<p style="font-size:0.85em; line-height:1.8; margin-bottom:0.6em;">${s.trim()}</p>`)
        .join('');
}


const FORM_DATA = {
  "I-130": { approvalRate: 0.81, histRate: "79.3%", pendingPct: 0.72, pendingCount: "1,842,000", backlogRatio: "312%" },
  "I-485": { approvalRate: 0.87, histRate: "84.1%", pendingPct: 0.68, pendingCount: "930,000",   backlogRatio: "180%" },
  "I-600": { approvalRate: 0.91, histRate: "89.7%", pendingPct: 0.21, pendingCount: "1,800",     backlogRatio: "28%"  },
  "I-800": { approvalRate: 0.88, histRate: "86.2%", pendingPct: 0.24, pendingCount: "2,100",     backlogRatio: "32%"  },
  "I-129": { approvalRate: 0.83, histRate: "80.6%", pendingPct: 0.38, pendingCount: "238,000",   backlogRatio: "41%"  },
  "I-140": { approvalRate: 0.92, histRate: "90.1%", pendingPct: 0.31, pendingCount: "172,000",   backlogRatio: "55%"  },
  "I-526": { approvalRate: 0.66, histRate: "63.4%", pendingPct: 0.84, pendingCount: "18,400",    backlogRatio: "210%" },
  "I-539": { approvalRate: 0.74, histRate: "71.8%", pendingPct: 0.65, pendingCount: "640,000",   backlogRatio: "220%" },
  "I-765": { approvalRate: 0.93, histRate: "91.2%", pendingPct: 0.44, pendingCount: "590,000",   backlogRatio: "88%"  },
  "N-400": { approvalRate: 0.91, histRate: "89.5%", pendingPct: 0.38, pendingCount: "750,000",   backlogRatio: "75%"  },
  "N-600": { approvalRate: 0.87, histRate: "85.3%", pendingPct: 0.29, pendingCount: "82,000",    backlogRatio: "48%"  },
  "I-90":  { approvalRate: 0.96, histRate: "95.1%", pendingPct: 0.19, pendingCount: "204,000",   backlogRatio: "22%"  },
  "I-131": { approvalRate: 0.88, histRate: "85.9%", pendingPct: 0.52, pendingCount: "310,000",   backlogRatio: "98%"  },
  "I-589": { approvalRate: 0.43, histRate: "41.2%", pendingPct: 0.91, pendingCount: "1,020,000", backlogRatio: "490%" },
  "I-751": { approvalRate: 0.86, histRate: "84.0%", pendingPct: 0.61, pendingCount: "285,000",   backlogRatio: "142%" },
  "I-821": { approvalRate: 0.82, histRate: "80.1%", pendingPct: 0.47, pendingCount: "310,000",   backlogRatio: "85%"  },
};

function predict() {
  const input = document.getElementById('search-box');
  const code  = (input.dataset.number || input.value.trim().split(' ')[0]).toUpperCase();
  if (!code) return;

  const data = FORM_DATA[code];
  if (!data) return;  // form not in our dataset, silently skip

  // Approval
  const approvalPct = Math.round(data.approvalRate * 100);
  document.getElementById('r-approval-pct').textContent = approvalPct + '%';
  document.getElementById('r-hist-rate').textContent    = data.histRate;

  const aBadge = document.getElementById('r-approval-badge');
  if (approvalPct >= 85) {
    aBadge.textContent = '✅ Strong approval outlook';
    aBadge.className   = 'pred-badge badge-strong';
  } else if (approvalPct >= 65) {
    aBadge.textContent = '🟡 Moderate approval outlook';
    aBadge.className   = 'pred-badge badge-moderate';
  } else {
    aBadge.textContent = '❌ Low approval outlook';
    aBadge.className   = 'pred-badge badge-low';
  }

  // Pending
  const pendPct = Math.round(data.pendingPct * 100);
  document.getElementById('r-pending-pct').textContent   = pendPct + '%';
  document.getElementById('r-pending-count').textContent = data.pendingCount;
  document.getElementById('r-backlog-ratio').textContent = data.backlogRatio;

  const pBar   = document.getElementById('r-pending-bar');
  const pBadge = document.getElementById('r-pending-badge');
  pBar.className = 'pred-fill';
  if (data.pendingPct >= 0.70) {
    pBar.classList.add('pred-fill-high');
    pBadge.textContent = '🔴 High risk of being left pending';
    pBadge.className   = 'pred-badge badge-low';
  } else if (data.pendingPct >= 0.40) {
    pBar.classList.add('pred-fill-medium');
    pBadge.textContent = '🟡 Moderate risk of being left pending';
    pBadge.className   = 'pred-badge badge-moderate';
  } else {
    pBar.classList.add('pred-fill-low');
    pBadge.textContent = '🟢 Low risk of being left pending';
    pBadge.className   = 'pred-badge badge-strong';
  }

  // Show and animate bars
  document.getElementById('pred-results').className = 'pred-results visible';
  setTimeout(() => {
    document.getElementById('r-approval-bar').style.width = approvalPct + '%';
    pBar.style.width = pendPct + '%';
  }, 80);
}

let currentForm = '';

// Override submitForm to also set currentForm
function submitForm() {
  const formNumber = input.dataset.number || input.value.trim().split(' ')[0];
  if (!formNumber) return;
  currentForm = formNumber;
  sendPrompt(formNumber);
  predict();
}

// Follow-up chat
async function sendFollowup() {
  const question    = document.getElementById('followup-input').value.trim();
  const responseBox = document.getElementById('followup-response');
  if (!question) return;

  const prompt = currentForm
    ? `Regarding USCIS form ${currentForm}: ${question}`
    : question;

  responseBox.innerHTML = '<em style="color:#aaa;">Thinking...</em>';
  let fullText = '';

  try {
    const res = await fetch('http://localhost:8000/api/followup', {  // <-- new endpoint
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt, model: 'meta-llama/Llama-3.1-8B-Instruct:cerebras' }),
    });

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    responseBox.innerHTML = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const payload = JSON.parse(line.slice(6));
        fullText += payload.token;
        responseBox.innerHTML = `<p style="white-space:pre-wrap; line-height:1.8;">${fullText}</p>`;
      }
    }
  } catch (err) {
    responseBox.innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
  }
}

async function findLawyers() {
  const zip         = document.getElementById('zipcode-input').value.trim();
  const responseBox = document.getElementById('lawyer-response');

  if (!zip || zip.length !== 5 || isNaN(zip)) {
    responseBox.innerHTML = '<p style="color:red;">Please enter a valid 5-digit zip code.</p>';
    return;
  }

  responseBox.innerHTML = '<em style="color:#aaa;">Searching nearby lawyers...</em>';

  try {
    const res  = await fetch('http://localhost:8000/api/lawyers', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ zipcode: zip }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    if (!data.lawyers.length) {
      responseBox.innerHTML = '<p style="color:#aaa;">No lawyers found near that zip code.</p>';
      return;
    }

    responseBox.innerHTML = `
	<div style="display:flex; gap:1em; flex-wrap:wrap; margin-top:1em;">
		${data.lawyers.map((l, i) => `
		<div style="flex:1; min-width:160px; background:#f9f9f9; border:1px solid #eee; border-radius:6px; padding:0.8em; font-size:0.8em; line-height:1.6;">
			<strong>${i + 1}. ${l.name}</strong><br/>
			<span style="color:#666;">📍 ${l.address}</span><br/>
			<span style="color:#666;">⭐ ${l.rating}</span>
			${l.open === true  ? '<br/><span style="color:green;">✅ Open</span>'  : ''}
			${l.open === false ? '<br/><span style="color:red;">❌ Closed</span>' : ''}
		</div>
		`).join('')}
	</div>
	`;

  } catch (err) {
    responseBox.innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
  }
}