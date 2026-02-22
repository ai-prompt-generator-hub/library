(function () {
	'use strict';

	// Replace with your Web OAuth 2.0 Client ID (Google Cloud Console – Web application, authorized origin: https://ai-prompt-generator-hub.github.io)
	const GOOGLE_CLIENT_ID = '419566393520-nvmbiv3tfg06objltkqg1cpmtrjg4r6o.apps.googleusercontent.com';
	const LIBRARY_API_BASE = 'https://prompt-generator.andreidmit2704.workers.dev';

	let idToken = null;
	let currentLibraryItems = [];

	const signInWrap = document.getElementById('signInWrap');
	const signedInWrap = document.getElementById('signedInWrap');
	const userEmailEl = document.getElementById('userEmail');
	const signOutBtn = document.getElementById('signOutBtn');
	const googleSignInBtn = document.getElementById('googleSignInBtn');
	const loadingState = document.getElementById('loadingState');
	const emptyState = document.getElementById('emptyState');
	const listWrap = document.getElementById('listWrap');
	const promptList = document.getElementById('promptList');
	const actionStatus = document.getElementById('actionStatus');
	let actionStatusTimer = null;

	function setSectionVisible(el, visible) {
		if (!el) return;
		el.hidden = !visible;
		el.classList.toggle('hidden', !visible);
	}

	function showView(which) {
		setSectionVisible(loadingState, which === 'loading');
		setSectionVisible(emptyState, which === 'empty');
		setSectionVisible(listWrap, which === 'list');
	}

	function showActionStatus(message, isError) {
		if (!message) return;
		if (!actionStatus) {
			if (isError) alert(message);
			return;
		}
		actionStatus.textContent = message;
		actionStatus.hidden = false;
		actionStatus.classList.remove('is-error', 'is-success');
		actionStatus.classList.add(isError ? 'is-error' : 'is-success');
		if (actionStatusTimer) clearTimeout(actionStatusTimer);
		actionStatusTimer = setTimeout(function () {
			actionStatus.hidden = true;
			actionStatus.textContent = '';
			actionStatus.classList.remove('is-error', 'is-success');
		}, 4000);
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
		currentLibraryItems = Array.isArray(items) ? items.slice() : [];
		promptList.innerHTML = '';
		if (!items || !items.length) {
			showView('empty');
			return;
		}
		showView('list');
		items.forEach(function (item, itemIndex) {
			const li = document.createElement('li');
			li.className = 'prompt-card';
			li.dataset.id = item.id || String(itemIndex);
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
				'<button type="button" class="btn btn-mini btn-secondary edit-btn">Edit</button>' +
				'<button type="button" class="btn btn-mini btn-secondary delete-btn">Delete</button>' +
				'</div>';
			const copyBtn = li.querySelector('.copy-btn');
			const toggleBtn = li.querySelector('.toggle-btn');
			const editBtn = li.querySelector('.edit-btn');
			const deleteBtn = li.querySelector('.delete-btn');
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
			deleteBtn.addEventListener('click', function () {
				if (!confirm('Delete this prompt?')) return;
				var next = currentLibraryItems.filter(function (_, idx) { return idx !== itemIndex; });
				saveLibraryToCloud(next).then(function (ok) {
					if (ok) {
						renderPrompts(next);
						showActionStatus('Prompt deleted.', false);
					} else {
						showActionStatus('Could not delete prompt. Please try again.', true);
					}
				});
			});
			editBtn.addEventListener('click', function () {
				var wrap = document.createElement('div');
				wrap.className = 'prompt-edit-wrap';
				wrap.innerHTML =
					'<label>Name</label><input type="text" class="prompt-edit-name" value="' + escapeHtml((item.name || '').trim()) + '">' +
					'<label>Prompt</label><textarea class="prompt-edit-text" rows="6">' + escapeHtml(text) + '</textarea>' +
					'<div class="prompt-edit-actions"><button type="button" class="btn btn-mini btn-secondary prompt-edit-cancel">Cancel</button><button type="button" class="btn btn-mini prompt-edit-save">Save</button></div>';
				li.querySelector('.prompt-preview').style.display = 'none';
				li.querySelector('.prompt-text').style.display = 'none';
				li.querySelector('.prompt-actions').style.display = 'none';
				li.classList.add('is-editing');
				li.appendChild(wrap);
				var nameInput = wrap.querySelector('.prompt-edit-name');
				var textArea = wrap.querySelector('.prompt-edit-text');
				wrap.querySelector('.prompt-edit-cancel').addEventListener('click', function () {
					wrap.remove();
					li.querySelector('.prompt-preview').style.display = '';
					li.querySelector('.prompt-text').style.display = '';
					li.querySelector('.prompt-actions').style.display = '';
					li.classList.remove('is-editing');
				});
				wrap.querySelector('.prompt-edit-save').addEventListener('click', function () {
					var newName = (nameInput.value || '').trim();
					var newText = (textArea.value || '').trim();
					if (!newText) {
						showActionStatus('Prompt text cannot be empty.', true);
						return;
					}
					var idx = itemIndex;
					if (idx === -1) return;
					var existing = currentLibraryItems[idx] || item || {};
					currentLibraryItems[idx] = {
						...existing,
						name: newName || newText.slice(0, 120),
						text: newText,
						ts: existing.ts || item.ts || Date.now()
					};
					saveLibraryToCloud(currentLibraryItems).then(function (ok) {
						if (ok) {
							renderPrompts(currentLibraryItems);
							showActionStatus('Prompt saved.', false);
						} else {
							showActionStatus('Could not save changes. Please try again.', true);
						}
					});
				});
			});
			promptList.appendChild(li);
		});
	}

	function escapeHtml(s) {
		const div = document.createElement('div');
		div.textContent = s;
		return div.innerHTML;
	}

	async function fetchLibrary(includeDebug) {
		if (!idToken) return { items: null, email: null, error: 'no-token', debug_key: null };
		try {
			const t = Date.now();
			const q = includeDebug ? '?debug=1&_=' + t : '?t=' + t + '&_=' + t;
			const res = await fetch(LIBRARY_API_BASE + '/library' + q, {
				method: 'GET',
				headers: { authorization: 'Bearer ' + idToken },
				cache: 'no-store'
			});
			const data = res.ok ? await res.json() : null;
			if (!res.ok) {
				return { items: null, email: null, error: res.status === 401 ? 'unauthorized' : 'fetch-failed', debug_key: null };
			}
			return {
				items: Array.isArray(data.items) ? data.items : [],
				email: data.email || null,
				error: null,
				debug_key: data.debug_key || null,
				debug_kv_found: data.debug_kv_found,
				debug_kv_length: data.debug_kv_length
			};
		} catch (e) {
			return { items: null, email: null, error: 'fetch-failed', debug_key: null };
		}
	}

	async function saveLibraryToCloud(items) {
		if (!idToken || !Array.isArray(items)) return false;
		try {
			const res = await fetch(LIBRARY_API_BASE + '/library', {
				method: 'POST',
				headers: { 'content-type': 'application/json', authorization: 'Bearer ' + idToken },
				body: JSON.stringify({ items }),
				cache: 'no-store'
			});
			return res.ok;
		} catch (e) {
			return false;
		}
	}

	function initGoogleSignIn() {
		if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('YOUR_')) {
			loadingState.innerHTML = '<p>Set your Web app Client ID in <code>app.js</code>: <code>GOOGLE_CLIENT_ID = \'xxx.apps.googleusercontent.com\'</code>. Get it from Google Cloud Console → Credentials → OAuth 2.0 Client ID (Web application). Add this site’s URL to Authorized JavaScript origins.</p>';
			return;
		}
		if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
			loadingState.innerHTML = '<p>Sign-in is loading… If the button doesn’t appear, check that <strong>' + window.location.origin + '</strong> is in Google Cloud Console → Credentials → your Web client → Authorized JavaScript origins.</p>';
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
		const { items, email, error } = await fetchLibrary(true);
		if (items === null) {
			if (error === 'unauthorized') {
				idToken = null;
				try { sessionStorage.removeItem('pg_library_token'); } catch (e) {}
				setSignedIn(false);
				showView('loading');
				loadingState.innerHTML = '<p><strong>Use the same Google account</strong> as in the extension.</p><p>Sign in again with that account.</p>';
			} else {
				setSignedIn(true, email);
				showView('empty');
				emptyState.innerHTML = '<p><strong>Couldn’t load library.</strong></p><p>Check your connection.</p><button type="button" id="retryLoadBtn" class="btn btn-secondary">Try again</button>';
				document.getElementById('retryLoadBtn')?.addEventListener('click', loadLibraryAndRender);
			}
			return;
		}
		setSignedIn(true, email);
		currentLibraryItems = Array.isArray(items) ? items.slice() : [];
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
	document.getElementById('refreshLibraryBtn')?.addEventListener('click', function () {
		loadLibraryAndRender();
	});
	document.getElementById('emptyRefreshBtn')?.addEventListener('click', function () {
		loadLibraryAndRender();
	});
	document.getElementById('showKeyBtn')?.addEventListener('click', async function () {
		var resultEl = document.getElementById('keyResult');
		if (!resultEl) return;
		var existing = document.getElementById('debugPromptsList');
		if (existing) existing.remove();
		resultEl.textContent = 'Loading…';
		var r = await fetchLibrary(true);
		if (r.debug_key !== undefined && r.debug_key !== null) {
			var msg = 'Key: ' + r.debug_key;
			if (r.debug_kv_found === true) {
				msg += ' — KV has data (' + (r.debug_kv_length || 0) + ' chars). Items parsed: ' + (Array.isArray(r.items) ? r.items.length : 0) + '.';
			} else if (r.debug_kv_found === false) {
				msg += ' — KV returned nothing for this key. Check in Cloudflare that this exact key exists and the Worker has the KV binding.';
			} else {
				msg += ' — In Cloudflare KV, compare this key with your extension data.';
			}
			resultEl.textContent = msg;
			if (Array.isArray(r.items)) {
				renderPrompts(r.items);
			}
			if (Array.isArray(r.items) && r.items.length > 0) {
				var box = document.createElement('div');
				box.id = 'debugPromptsList';
				box.style.marginTop = '1rem';
				box.style.padding = '1rem';
				box.style.background = 'var(--panel, #121a2d)';
				box.style.borderRadius = '12px';
				box.style.border = '1px solid var(--border, #1f2942)';
				box.innerHTML = '<p style="margin:0 0 0.75rem 0; font-weight:600;">Your prompts (' + r.items.length + '):</p>';
				r.items.forEach(function (item) {
					var name = (item.name || item.text || '').trim().slice(0, 200) || '(Untitled)';
					var text = (item.text || '').trim();
					var preview = text.slice(0, 150) + (text.length > 150 ? '…' : '');
					var card = document.createElement('div');
					card.style.cssText = 'margin-bottom:0.75rem; padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:8px;';
					card.innerHTML = '<div style="font-weight:600; margin-bottom:0.25rem;">' + escapeHtml(name) + '</div><pre style="margin:0; white-space:pre-wrap; word-break:break-word; font-size:12px;">' + escapeHtml(preview) + '</pre><button type="button" class="btn btn-mini" style="margin-top:0.5rem;">Copy</button>';
					var copyBtn = card.querySelector('button');
					copyBtn.addEventListener('click', function () {
						navigator.clipboard.writeText(text).then(function () { copyBtn.textContent = 'Copied!'; setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1000); });
					});
					box.appendChild(card);
				});
				resultEl.after(box);
			}
		} else if (r.error === 'unauthorized') {
			resultEl.textContent = 'Session expired or invalid. Sign out (above), then sign in again with the same Google account you use in the extension. Then click Show storage key again.';
		} else if (r.error === 'no-token') {
			resultEl.textContent = 'Not signed in. Sign in with Google first, then click Show storage key.';
		} else {
			resultEl.textContent = 'Could not get key (check connection or redeploy the Worker with the latest code). Sign out and sign in again, then try Show storage key.';
		}
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

	// Wait for Google Identity script to load, then init (script is loaded with async defer)
	function runWhenReady() {
		if (!restoreSession()) {
			function tryInit() {
				if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
					initGoogleSignIn();
					return true;
				}
				return false;
			}
			if (tryInit()) return;
			loadingState.innerHTML = '<p>Loading sign-in…</p>';
			var attempts = 0;
			var t = setInterval(function () {
				attempts++;
				if (tryInit()) {
					clearInterval(t);
					return;
				}
				if (attempts >= 15) {
					clearInterval(t);
					loadingState.innerHTML = '<p><strong>Sign-in didn’t load.</strong></p><p>Add this site’s URL to Google Cloud Console → Credentials → your Web client → Authorized JavaScript origins:</p><p style="word-break:break-all;font-size:12px;">' + escapeHtml(window.location.origin) + '</p><p><a href="#" id="retrySignInLink" class="link">Refresh the page</a> to try again.</p>';
					document.getElementById('retrySignInLink')?.addEventListener('click', function (e) { e.preventDefault(); window.location.reload(); });
				}
			}, 200);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', runWhenReady);
	} else {
		runWhenReady();
	}
})();
