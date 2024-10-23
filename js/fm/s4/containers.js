lazy(s4, 'containers', () => {
    'use strict';

    const { exportKey, logger } = s4.utils;
    const { S4PagedDialog } = s4.ui.classes;

    class S4SetupDialog extends S4PagedDialog {
        constructor(name) {
            super(name, $('.s4-setup-dialog', '.mega-dialog-container'), 6);

            this.bucket = null;
            this.container = null;
            this.key = null;
            this.skipStep = 0;

            this.$manageBucketBtn = $('.manage-bucket-settings', this.$dialogContainer);
            this.$progressLabel = $('span', this.$dialogProgress);
            this.$sidePane = $('.side-pane', this.$dialogContainer);
            this.$skipStepBtn = $('.skip-step', this.$dialogContainer);
            this.$skipSetupBtn = $('.skip-setup', this.$dialogContainer);

            this.$bucketInput = new mega.ui.MegaInputs(
                $('input[name=bucket-name]', this.$steps[5]),
                {onShowError: true}
            );
            this.$keyInput = new mega.ui.MegaInputs(
                $('input[name=key-name-input]', this.$steps[3]),
                {onShowError: true}
            );
        }

        destroy(skipWarning) {
            if (this._closing) {
                return false;
            }

            if (skipWarning || this.step === 6) {
                super.destroy();
                this._clear();
                return;
            }

            msgDialog(
                `confirmation:!^${l.s4_skip_setup_btn}!${l[1597]}`,
                l[1597],
                l.s4_skip_setup_question,
                l.s4_skip_setup_warn,
                (yes) => {
                    if (yes) {
                        super.destroy();
                        this._clear();
                    }
                }
            );
        }

        show() {
            this._clear();
            if (!(this.container = s4.utils.getContainersList()[0])) {
                return false;
            }

            super.show();
        }

        unbindEvents() {
            super.unbindEvents();

            const {
                $bucketInput,
                $keyInput,
                $manageBucketBtn,
                $skipSetupBtn,
                $skipStepBtn,
                $steps
            } = this;

            $bucketInput.$input.unbind('keydown.s4dlg input.s4dlg');
            $keyInput.$input.unbind('keydown.s4dlg input.s4dlg');
            $manageBucketBtn.unbind('click.s4dlg');
            $skipSetupBtn.unbind('click.s4dlg');
            $skipStepBtn.unbind('click.s4dlg');
            $('button.copy', $steps[2]).unbind('click.s4dlg');
            $('button.toggle-vis', $steps[2]).unbind('click.s4dlg');
            $('button.download-key', $steps[4]).unbind('click.s4dlg');
        }

        bindEvents() {
            super.bindEvents();

            const {
                $bucketInput,
                $dialogProgress,
                $keyInput,
                $manageBucketBtn,
                $skipSetupBtn,
                $skipStepBtn,
                $steps
            } = this;

            // Step 1
            $skipSetupBtn.rebind('click.s4dlg', () => {
                this.destroy(true);
            });

            // Step 3 events
            $keyInput.$input.rebind('keydown.s4dlg', (e) => {
                if (e.which === 13) {
                    $dialogProgress.trigger('click');
                }
            });
            $keyInput.$input.rebind('input.s4dlg', () => {
                this._validateKey();
            });

            // Step 4 events
            $('button.copy', $steps[4]).rebind('click.s4dlg', e => {
                const { key } = this;
                const dataKey = $(e.currentTarget).attr('data-key');
                const { [dataKey]: value } = key;
                const message = dataKey === 'ak' ?
                    l.s4_access_key_copied_toast_txt : l.s4_secret_key_copied_toast_txt;

                copyToClipboard(value, message, 'recoveryKey');
            });

            $('button.toggle-vis', $steps[4]).rebind('click.s4dlg', e => {
                const $this = $('i', e.currentTarget);

                if ($this.hasClass('icon-eye-reveal')) {
                    $this.removeClass('icon-eye-reveal').addClass('icon-eye-hidden');
                    $('.secret-key-value', $steps[4]).attr('type', 'text');
                }
                else {
                    $this.removeClass('icon-eye-hidden').addClass('icon-eye-reveal');
                    $('.secret-key-value', $steps[4]).attr('type', 'password');
                }
            });

            $('button.download-key', $steps[4]).rebind('click.s4dlg', () => {
                this._download();
            });

            // Step 5 events
            $bucketInput.$input.rebind('keydown.s4dlg', (e) => {
                if (e.which === 13) {
                    $dialogProgress.trigger('click');
                }
            });

            $bucketInput.$input.rebind('input.s4dlg', () => {
                this._validateBucket();
            });

            $manageBucketBtn.rebind('click.s4dlg', () => {
                const n = M.getNodeByHandle(this.bucket);

                if (n) {
                    M.openFolder(n.h).then(() => {
                        s4.ui.showDialog(s4.buckets.dialogs.settings, n);
                    });
                }
            });

            // Skip steps btn
            $skipStepBtn.rebind('click.s4dlg', () => {
                if (this.skipStep) {
                    this.steps(this.skipStep);
                }
            });
        }

        step1(finalise) {
            if (finalise) {
                this.$sidePane.removeClass('intro');
                return Promise.resolve();
            }

            this.$progressLabel.text(l.s4_setup_s4_btn);
            this._switchStep();

            return Promise.resolve();
        }

        step2(finalise) {
            if (finalise) {
                return Promise.resolve();
            }

            s4.utils.renderEndpointsData(this.$steps[this.step]);
            this.$progressLabel.text(l[556]);
            this.$skipSetupBtn.addClass('hidden');

            this._switchStep();

            return Promise.resolve();
        }

        async step3(finalise) {
            if (finalise) {
                const n = this.$keyInput.$input.val().trim();
                this.stepLocked = true;

                if (this._getKeyNameError()) {
                    logger.error(`Incorrect key name: ${n}`);
                    return;
                }

                this.key = await s4.kernel.keys.create(this.container, null, n).catch(tell);
                this.stepLocked = false;

                return;
            }

            this.skipStep = 5;
            $(`.nav-step-${ this.step - 1 }`, this.$sidePane).addClass('complete');
            this.$progressLabel.text(l[158]);
            this.$skipStepBtn.removeClass('hidden');
            this._switchStep();

            this._validateKey();
            delay('s4.keyInput.focus', () => {
                this.$keyInput.$input.focus();
            }, 50);
        }

        async step4(finalise) {
            if (finalise) {
                return;
            }

            if (this.key) {
                const {ak, sk} = this.key;

                $('.access-key-value', this.$steps[4]).text(ak);
                $('.secret-key-value', this.$steps[4]).val(sk).attr('type', 'password');
                this.$progressLabel.text(l[556]);
                this.$dialogProgress.removeClass('disabled');
                this.$skipStepBtn.addClass('hidden');
                this._switchStep();
            }
        }

        async step5(finalise) {
            if (finalise) {
                this.stepLocked = true;
                const n = this.$bucketInput.$input.val().trim();

                if (this._getBucketNameError()) {
                    logger.error(`Incorrect bucket name: ${n}`);
                    return;
                }

                this.bucket = await s4.kernel.bucket.create(this.container, n).catch(tell);
                this.stepLocked = false;

                return;
            }

            this.skipStep = 6;
            $(`.nav-step-${ this.step - 1 }`, this.$sidePane).addClass('complete');
            this.$skipStepBtn.removeClass('hidden');
            this.$progressLabel.text(l[158]);
            this._switchStep();

            this._validateBucket();
            delay('s4.bucketInput.focus', () => {
                this.$bucketInput.$input.focus();
            }, 50);
        }

        async step6(finalise) {
            if (finalise) {
                return;
            }

            if (this.bucket) {
                this.$manageBucketBtn.removeClass('hidden');
            }

            $(`.nav-step-${ this.step - 1 }`, this.$sidePane).addClass('complete');
            this.$dialogProgress.removeClass('disabled');
            this.$skipStepBtn.addClass('hidden');
            this.$progressLabel.text(l[726]);
            this._switchStep();
        }

        _switchStep() {
            $('.content-pane > .steps', this.$dialogContainer).addClass('hidden');
            $(`.nav-step-${ this.step }`, this.$sidePane).addClass('active');

            this.$steps[this.step].removeClass('hidden');
        }

        _toggleButtonState(errorMsg) {
            if (errorMsg) {
                this.$dialogProgress.addClass('disabled');
            }
            else {
                this.$dialogProgress.removeClass('disabled');
            }
        }

        _clear() {
            this.bucket = null;
            this.container = null;
            this.key = null;
            this.skipStep = 0;

            this.$bucketInput.$input.val('');
            this.$keyInput.$input.val('');
            $('.secret-key-value', this.$steps[2]).val('').attr('type', 'password');
            $('.icon-eye-hidden', this.$steps[2]).addClass('icon-eye-reveal').removeClass('icon-eye-hidden');
            $('.nav-step', this.$sidePane).removeClass('active complete');
            this.$sidePane.addClass('intro');
            this.$dialogProgress.removeClass('disabled hidden');
            this.$manageBucketBtn.addClass('hidden');
            this.$skipStepBtn.addClass('hidden');
            this.$skipSetupBtn.removeClass('hidden');
        }

        _validateBucket() {
            const errorMsg = this._getBucketNameError();

            this._toggleButtonState(errorMsg);
            this._showErrorMessage(
                this.$bucketInput,
                errorMsg === l.s4_enter_bkt_name ? false : errorMsg
            );
        }

        _getBucketNameError() {
            const name = this.$bucketInput.$input.val();

            if (!name) {
                return l.s4_enter_bkt_name;
            }

            if (!s4.kernel.isValidBucketName(name)) {
                return l.s4_invalid_bucket_name;
            }

            if (duplicated(name, this.container)) {
                return l[23219];
            }
        }

        _validateKey() {
            const errorMsg = this._getKeyNameError();

            this._toggleButtonState(errorMsg);
            this._showErrorMessage(
                this.$keyInput,
                errorMsg === l.s4_key_empty_error ? false : errorMsg
            );
        }

        _getKeyNameError() {
            return s4.keys.handlers.validateName(this.$keyInput.$input.val());
        }

        _showErrorMessage(megaInput, errorMsg) {
            if (errorMsg) {
                megaInput.showError(errorMsg);
            }
            else {
                megaInput.hideError();
            }
        }

        async _download() {
            const {n, ak, sk} = this.key;
            await M.saveAs(exportKey(ak, sk), M.getSafeName(`credentials-${n}`));
            showToast('s4AccessKey', l.s4_key_downloaded_toast_txt);
        }
    }

    const dialogs = Object.create(null);
    lazy(dialogs, 'setup', () => new S4SetupDialog('s4-managed-setup'));

    return freeze({dialogs, S4SetupDialog});
});
