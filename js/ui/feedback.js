/**
 * js/ui/feedback.js — Модуль формы обратной связи (Feedback Modal)
 * Google Material 3 Expressive UI + Защищенная отправка отзыва
 */

(function() {
    'use strict';

    function getEndpoint() {
        if (typeof window !== 'undefined' && window.FEEDBACK_ENDPOINT) {
            return window.FEEDBACK_ENDPOINT;
        }
        return 'https://square-dust-4124.ruslan99001166236.workers.dev/post/feedback.php';
    }

    function openFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        const backdrop = document.getElementById('feedback-backdrop');
        const textarea = document.getElementById('feedback-message');
        const statusBox = document.getElementById('feedback-status');

        if (!modal || !backdrop) return;

        if (statusBox) {
            statusBox.className = 'hidden text-xs rounded-xl p-2.5 transition-all';
            statusBox.textContent = '';
        }

        modal.classList.add('is-open');
        backdrop.classList.add('is-open');

        if (textarea) {
            setTimeout(() => {
                textarea.focus();
            }, 100);
        }
    }

    function closeFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        const backdrop = document.getElementById('feedback-backdrop');
        if (!modal || !backdrop) return;

        modal.classList.remove('is-open');
        backdrop.classList.remove('is-open');
    }

    function setSubmittingState(isSubmitting) {
        const submitBtn = document.getElementById('btn-submit-feedback');
        const spinner = document.getElementById('feedback-spinner');
        const submitText = document.getElementById('feedback-submit-text');
        const textarea = document.getElementById('feedback-message');
        const contactInput = document.getElementById('feedback-contact');

        if (submitBtn) submitBtn.disabled = isSubmitting;
        if (textarea) textarea.disabled = isSubmitting;
        if (contactInput) contactInput.disabled = isSubmitting;

        if (spinner && submitText) {
            if (isSubmitting) {
                spinner.classList.remove('hidden');
                submitText.textContent = 'Отправка...';
            } else {
                spinner.classList.add('hidden');
                submitText.textContent = 'Отправить';
            }
        }
    }

    function showStatus(message, type) {
        const statusBox = document.getElementById('feedback-status');
        if (!statusBox) return;

        statusBox.classList.remove('hidden');
        if (type === 'success') {
            statusBox.className = 'text-xs rounded-xl p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
        } else {
            statusBox.className = 'text-xs rounded-xl p-2.5 bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50';
        }
        statusBox.textContent = message;
    }

    async function handleFeedbackSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();

        const hpField = document.getElementById('feedback-hp');
        if (hpField && hpField.value) {
            // Honeypot: тихий ложный успех для ботов
            showStatus('Спасибо! Ваш отзыв успешно отправлен.', 'success');
            setTimeout(closeFeedbackModal, 1500);
            return;
        }

        const textarea = document.getElementById('feedback-message');
        const contactInput = document.getElementById('feedback-contact');
        if (!textarea) return;

        const message = textarea.value.trim();
        if (message.length < 3) {
            showStatus('Пожалуйста, напишите сообщение (минимум 3 символа).', 'error');
            textarea.focus();
            return;
        }

        const contact = contactInput ? contactInput.value.trim() : '';

        // Анонимные технические метаданные для быстрой локализации бага
        const meta = {
            floor: (typeof STATE !== 'undefined' && STATE.mode) ? String(STATE.mode) : '1',
            bldg: (typeof STATE !== 'undefined' && STATE.buildingFilter) ? String(STATE.buildingFilter) : 'both',
            is2D: (typeof STATE !== 'undefined') ? Boolean(STATE.is2D) : true,
            screen: (typeof window !== 'undefined') ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
            url: (typeof window !== 'undefined' && window.location) ? window.location.pathname + window.location.search : ''
        };

        const payload = {
            contact: contact,
            message: message,
            meta: meta
        };

        setSubmittingState(true);

        try {
            const endpoint = getEndpoint();
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data && data.status === 'ok') {
                showStatus('Спасибо! Ваш отзыв успешно отправлен.', 'success');
                textarea.value = '';
                if (contactInput) contactInput.value = '';
                const charCount = document.getElementById('feedback-char-count');
                if (charCount) charCount.textContent = '0 / 2000';

                setTimeout(() => {
                    closeFeedbackModal();
                    setSubmittingState(false);
                }, 1800);
            } else {
                const errMsg = (data && data.error) ? data.error : 'Не удалось отправить отзыв. Попробуйте позже.';
                showStatus(errMsg, 'error');
                setSubmittingState(false);
            }
        } catch (err) {
            console.error('[Feedback] Submit failed:', err);
            showStatus('Ошибка отправки. Проверьте интернет или повторите позже.', 'error');
            setSubmittingState(false);
        }
    }

    function initFeedback() {
        const openBtn = document.getElementById('btn-open-feedback');
        const closeBtn = document.getElementById('btn-close-feedback');
        const cancelBtn = document.getElementById('btn-cancel-feedback');
        const backdrop = document.getElementById('feedback-backdrop');
        const form = document.getElementById('feedback-form');
        const textarea = document.getElementById('feedback-message');
        const charCount = document.getElementById('feedback-char-count');

        if (openBtn) openBtn.addEventListener('click', openFeedbackModal);
        if (closeBtn) closeBtn.addEventListener('click', closeFeedbackModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeFeedbackModal);
        if (backdrop) backdrop.addEventListener('click', closeFeedbackModal);

        if (textarea && charCount) {
            textarea.addEventListener('input', () => {
                charCount.textContent = `${textarea.value.length} / 2000`;
            });
        }

        if (form) {
            form.addEventListener('submit', handleFeedbackSubmit);
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('feedback-modal');
                if (modal && modal.classList.contains('is-open')) {
                    closeFeedbackModal();
                }
            }
        });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initFeedback);
        } else {
            initFeedback();
        }
    }

    if (typeof window !== 'undefined') {
        window.openFeedbackModal = openFeedbackModal;
        window.closeFeedbackModal = closeFeedbackModal;
        window.initFeedback = initFeedback;
    }
})();
