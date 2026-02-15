(function () {
	'use strict';

	// Replace with your Web OAuth 2.0 Client ID (Google Cloud Console – Web application, authorized origin: https://ai-prompt-generator-hub.github.io)
	const GOOGLE_CLIENT_ID = '419566393520-nvmbiv3tfg06objltkqg1cpmtrjg4r6o.apps.googleusercontent.com';
	const LIBRARY_API_BASE = 'https://prompt-generator.andreidmit2704.workers.dev';

	let idToken = null;

	const signInWrap = document.getElementById('signInWrap');
	const signedInWrap = document.getElementById('signedInWrap');
	const userEmailEl = document.getElementById('userEmail');
	const signOutBtn = document.getElementById('signOutBtn');
	const googleSignInBtn = document.getElementById('googleSignInBtn');
	const loadingState = document.getElementById('loadingState');
	const emptyState = document.getElementById('emptyState');
	const listWrap = document.getElementById('listWrap');
	const promptList = document.getElementById('promptList');

	function showView(which) {
		loadingState.classList.add('hidden');
		emptyState.classList.add('hidden');
		listWrap.classList.add('hidden');
		if (which === 'loading') loadingState.classList.remove('hidden');
		else if (which === 'empty') emptyState.classList.remove('hidden');
		else if (which === 'list') listWrap.classList.remove('hidden');
	}

	function setSignedIn(signedIn, email) {
		if (signedIn) {
			signInWrap.setAttribute('hidden', '');
			signedInWrap.removeAttribute('hidden');
			if (userEmailEl) userEmailEl.textContent = email ? `Signed in as ${email}` : 'Signed in';
		} else {
			signedInWrap.setAttribute('hidden', '');
			signInWrap.removeAttribute('hidden');
			if (userEmailEl) userEmailEl.textContent = '';
		}
	}

	function renderPrompts(items) {
		if (!promptList) return;
		promptList.innerHTML = '';
		if (!items || !items.length) {
			showView('empty');
			return;
		}
		showView('list');
		items.forEach(function (item) {
			const li = document.createElement('li');
			li.className = 'prompt-card';
			const name = (item.name || item.text || '').trim().slice(0, 200) || '(Untitled)';
			const text = (item.text || '').trim();
			const date = item.ts ? new Date(item.ts).toLocaleDateString() : '';
			li.innerHTML =
				'<div class="prompt-name">' + escapeHtml(name) + '</div>' +
				(date ? '<div class="prompt-meta">' + escapeHtml(date) + '</div>' : '') +
				'<div class="prompt-preview">' + escapeHtml(text.slice(0, 120)) + (text.length > 120 ? '…' : '') + '</div>' +
				'<pre class="prompt-text">' + escapeHtml(text) + '</pre>' +
				'<div class="prompt-actions">' +
				'<button type="button" class="btn btn-mini copy-btn">Copy</button>' +
				'<button type="button" class="btn btn-mini btn-secondary toggle-btn">Show full</button>' +
				'</div>';
			const copyBtn = li.querySelector('.copy-btn');
			const toggleBtn = li.querySelector('.toggle-btn');
			const preview = li.querySelector('.prompt-preview');
			const fullText = li.querySelector('.prompt-text');
			copyBtn.addEventListener('click', function () {
				navigator.clipboard.writeText(text).then(function () {
					copyBtn.textContent = 'Copied!';
					setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1200);
				});
			});
			toggleBtn.addEventListener('click', function () {
				li.classList.toggle('is-open');
				toggleBtn.textContent = li.classList.contains('is-open') ? 'Collapse' : 'Show full';
			});
			promptList.appendChild(li);
		});
	}

	function escapeHtml(s) {
		const div = document.createElement('div');
		div.textContent = s;
		return div.innerHTML;
	}

	async function fetchLibrary() {
		if (!idToken) return { items: null, email: null };
		try {
			const res = await fetch(LIBRARY_API_BASE + '/library', {
				method: 'GET',
				headers: { authorization: 'Bearer ' + idToken }
			});
			if (!res.ok) return { items: null, email: null };
			const data = await res.json();
			return {
				items: Array.isArray(data.items) ? data.items : [],
				email: data.email || null
			};
		} catch {
			return { items: null, email: null };
		}
	}

	function initGoogleSignIn() {
		if (typeof google === 'undefined' || !google.accounts || !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('YOUR_')) {
			loadingState.innerHTML = '<p>Configure <code>GOOGLE_CLIENT_ID</code> in <code>app.js</code> for Sign in with Google.</p>';
			return;
		}
		google.accounts.id.initialize({
			client_id: GOOGLE_CLIENT_ID,
			callback: function (credentialResponse) {
				idToken = credentialResponse.credential || null;
				try { if (idToken) sessionStorage.setItem('pg_library_token', idToken); } catch (e) {}
				if (idToken) {
					loadLibraryAndRender();
					setSignedIn(true);
				}
			},
			ux_mode: 'popup',
			auto_select: false
		});
		google.accounts.id.renderButton(googleSignInBtn, {
			type: 'standard',
			theme: 'filled_black',
			size: 'large',
			text: 'signin_with',
			shape: 'rectangular'
		});
	}

	async function loadLibraryAndRender() {
		showView('loading');
		const { items, email } = await fetchLibrary();
		if (items === null) {
			setSignedIn(false);
			idToken = null;
			try { sessionStorage.removeItem('pg_library_token'); } catch (e) {}
			showView('loading');
			loadingState.innerHTML = '<p>Failed to load library. Try signing in again.</p>';
			return;
		}
		setSignedIn(true, email);
		renderPrompts(items);
	}

	signOutBtn.addEventListener('click', function () {
		idToken = null;
		if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
			google.accounts.id.disableAutoSelect();
		}
		setSignedIn(false);
		showView('loading');
		loadingState.innerHTML = '<p>Sign in with Google to see your saved prompts.</p>';
	});

	// Check for token in sessionStorage so refresh keeps user signed in during session
	function restoreSession() {
		try {
			const stored = sessionStorage.getItem('pg_library_token');
			if (stored) {
				idToken = stored;
				loadLibraryAndRender();
				setSignedIn(true);
				return true;
			}
		} catch (e) {}
		return false;
	}

	// On load: try restore session, else show sign-in
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () {
			if (!restoreSession()) initGoogleSignIn();
		});
	} else {
		if (!restoreSession()) initGoogleSignIn();
	}
})();
