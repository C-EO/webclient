mega.ui.pm.settings = {

    initUI() {
        'use strict';

        if (!this.wrap) {
            const settingsWrap = document.createElement('div');
            settingsWrap.className = 'settings-wrap';
            pmlayout.append(settingsWrap);
            this.wrap = settingsWrap;

            const settingsContainer = document.createElement('div');
            settingsContainer.className = 'settings-container';
            settingsWrap.append(settingsContainer);

            this.drawSettings();
        }

        this.wrap.classList.remove('hidden');

        if (d) {
            console.info('PWM Settings Initialized.');
        }
    },

    closeUI() {
        'use strict';

        if (this.wrap) {
            this.wrap.classList.add('hidden');
        }
    },

    async drawSettings() {
        'use strict';

        this.importProvider = {
            'google': l.google_password_manager,
            'keepass': l.keepass,
            'lastpass': l.lastpass
        };

        this.file = null;
        this.importSelected = 'google';
        this.importInFlight = false;

        const settingsContainer = document.querySelector('.settings-container');

        const settingsUI = {};

        settingsUI.accountList = new MegaPassList({
            parentNode: settingsContainer,
            title: l.mega_account_title,
            items: {
                'account-settings': {
                    title: l.account_settings_title,
                    subtitle: l.account_settings_subtitle,
                    iconButton: {
                        icon: 'sprite-pm-mono icon-external-link-thin-outline',
                        text: l.account_settings_label,
                        href: '/fm/account',
                        iconSize: 24,
                        iconSizeSmall: 16,
                        title: l.account_settings_label,
                        evId: 500574
                    }
                }
            }
        });

        const importBlock = settingsUI.import = new MegaPassList({
            parentNode: settingsContainer,
            title: l.import_title
        });

        importBlock.domNode.id = 'import';

        const importTitleItem = document.createElement('div');
        importTitleItem.className = 'mega-list-item';
        const titleItemText = document.createElement('div');
        titleItemText.className = 'mega-list-item-text';
        importTitleItem.append(titleItemText);
        const importTitle = document.createElement('span');
        importTitle.className = 'mega-item-list-title';
        importTitle.textContent = l.import_password;
        titleItemText.appendChild(importTitle);
        const importSubtitle = document.createElement('span');
        importSubtitle.className = 'mega-item-list-subtitle';
        importSubtitle.textContent = l.import_notes;
        titleItemText.appendChild(importSubtitle);
        importBlock.listNode.append(importTitleItem);

        const importSelectItem = document.createElement('div');
        importSelectItem.className = 'mega-list-item force-wrap';
        const selectItemText = document.createElement('div');
        selectItemText.className = 'mega-list-item-text';
        importSelectItem.append(selectItemText);
        const selectFileTitle = document.createElement('span');
        selectFileTitle.className = 'mega-item-list-title-small';
        selectFileTitle.textContent = l.select_file_label;
        selectItemText.appendChild(selectFileTitle);
        const selectFileNotes = document.createElement('span');
        selectFileNotes.className = 'mega-item-list-subtitle';
        selectFileNotes.append(parseHTML(l.select_file_notes));
        selectItemText.appendChild(selectFileNotes);
        const buttonLine = document.createElement('div');
        buttonLine.className = 'mega-list-item-second';
        importSelectItem.appendChild(buttonLine);
        settingsUI.importProviderDropdown = new MegaDropdown({
            parentNode: buttonLine,
            dropdownOptions: {},
            text: l.google_password_manager,
            selected: this.importSelected,
            id: 'import-provider-dropdown',
            name: 'import-provider-dropdown',
            dropdownItems: this.importProvider,
            onSelected: mega.ui.pm.settings.utils.selectProvider
        });
        const fileInput = document.createElement('input');
        fileInput.style.display = 'none';
        fileInput.type = 'file';
        fileInput.multiple = false;
        fileInput.accept = '.csv';
        fileInput.id = 'file-select';
        buttonLine.appendChild(fileInput);
        const chooseFileBtn = new MegaButton({
            parentNode: buttonLine,
            componentClassname: 'choose-file secondary',
            text: l.choose_file_btn,
            onClick: mega.ui.pm.settings.utils.getFile
        });
        importBlock.listNode.append(importSelectItem);

        const importButtonItem = document.createElement('div');
        importButtonItem.className = 'mega-list-item force-wrap';
        const importButtonText = document.createElement('div');
        importButtonText.className = 'mega-list-item-text';
        importButtonItem.append(importButtonText);
        const importBtnText = document.createElement('span');
        importBtnText.className = 'mega-item-list-title-small import-passwords-label';
        importBtnText.textContent = l.import_passwords_label;
        importButtonText.appendChild(importBtnText);
        importButtonItem.append(importButtonText);
        const importButtonLine = document.createElement('div');
        importButtonLine.className = 'mega-list-item-second';
        importButtonItem.append(importButtonLine);
        const errorMessage = document.createElement('span');
        errorMessage.className = 'mega-item-list-title-small import-error-message hidden';
        errorMessage.textContent = l.import_fail_message;
        errorMessage.prepend(parseHTML('<i class="sprite-pm-mono icon-alert-triangle-thin-outline"></i>'));
        const importBtn = new MegaButton({
            parentNode: importButtonLine,
            text: l.import_passwords_btn,
            disabled: true,
            loader: true,
            componentClassname: 'import-file',
            onClick: () => {
                if (this.file && mega.pm.validateUserStatus()) {
                    const reader = new FileReader();

                    reader.onloadstart = function() {
                        importBtn.loading = true;
                        mega.ui.pm.settings.importInFlight = true;
                        errorMessage.classList.add('hidden');
                    };

                    reader.onload = function(e) {
                        const text = e.target.result;
                        const data = mega.ui.pm.settings.utils.parseCSV(text, mega.ui.pm.settings.importSelected);
                        if (data.length > 0) {
                            mega.ui.pm.settings.utils.saveData(data, mega.ui.pm.settings.importSelected)
                                .then(() => {
                                    chooseFileBtn.disabled = false;
                                    importBtn.disabled = true;
                                    importBtn.loading = false;
                                    mega.ui.toast.show(l.import_success_toast);
                                    importBtnText.textContent = l.import_passwords_label;
                                    fileInput.value = '';
                                    mega.ui.pm.settings.file = null;
                                    mega.ui.pm.settings.importInFlight = false;
                                    eventlog(mega.ui.pm.settings.importSelected === 'google' ? 590024
                                        : mega.ui.pm.settings.importSelected === 'keepass' ? 590025
                                            : 590026);
                                });
                        }
                        else {
                            errorMessage.classList.remove('hidden');
                            chooseFileBtn.disabled = false;
                            importBtn.disabled = false;
                            importBtn.loading = false;
                            importBtn.domNode.blur();
                        }
                    };
                    reader.readAsText(this.file);
                }
            }
        });
        importBlock.listNode.append(importButtonItem);
        importButtonLine.append(errorMessage);

        fileInput.addEventListener('change', (e) => {
            this.file = e.target.files[0];
            if (this.file) {
                importBtnText.textContent = l.import_passwords_label_selected.replace('%1', this.file.name);
                importBtn.disabled = false;
                errorMessage.classList.add('hidden');
            }
        });

        settingsUI.securityList = new MegaPassList({
            parentNode: settingsContainer,
            title: l[7337],
            items: {
                'recovery-key': {
                    title: l.recovery_key_title,
                    subtitle: parseHTML(l.recovery_key_subtitle),
                    iconButton: {
                        icon: 'sprite-pm-mono icon-download-thin-outline',
                        text: l.recovery_key_button_label,
                        iconSize: 24,
                        iconSizeSmall: 16,
                        title: l.recovery_key_button_label,
                        onClick: async() => {
                            const recoveryKey = a32_to_base64(window.u_k || '');

                            M.saveAs(recoveryKey, `${M.getSafeName(l[20830])}.txt`)
                                .then(() => {
                                    mega.ui.toast.show(l.recovery_key_download_toast); // Downloaded copy
                                    eventlog(99994);
                                })
                                .catch(tell);
                        }
                    }
                }
            }
        });

        settingsUI.contactList = new MegaPassList({
            parentNode: settingsContainer,
            title: l.footer_heading_help,
            items: {
                'help-centre': {
                    title: l.mobile_settings_help_title,
                    subtitle: l.settings_help_centre_desc,
                    iconButton: {
                        icon: 'sprite-pm-mono icon-external-link-thin-outline',
                        text: l.mobile_settings_help_title,
                        href: 'help',
                        iconSize: 24,
                        iconSizeSmall: 16,
                        title: l.mobile_settings_help_title,
                        evId: 500580
                    }
                },
                'contact-us': {
                    title: l[399],
                    subtitle: l.settings_contact_us_desc,
                    iconButton: {
                        icon: 'sprite-pm-mono icon-external-link-thin-outline',
                        text: l[399],
                        href: 'contact',
                        iconSize: 24,
                        iconSizeSmall: 16,
                        title: l[399],
                        evId: 500581
                    }
                }
            }
        });

        onIdle(() => {
            const wrap = document.querySelector('.settings-wrap');
            if (wrap.Ps) {
                wrap.Ps.update();
            }
            else {
                wrap.Ps = new PerfectScrollbar(wrap);
            }
        });
    }
};