(function _properties(global) {
    'use strict';

    /**
     * Handles node properties/info dialog contact list content
     * @param {Object} $dialog The properties dialog
     * @param {Array} users The list of users to whom we're sharing the selected nodes
     * @private
     */
    function fillPropertiesContactList($dialog, users) {

        var MAX_CONTACTS = 5;
        var shareUsersHtml = '';
        var $shareUsers = $dialog.find('.properties-body .properties-context-menu')
            .empty()
            .append('<div class="properties-context-arrow"></div>');

        for (var i = users.length; i--;) {
            var user = users[i];
            var userHandle = user.u || user.p;
            var hidden = i >= MAX_CONTACTS ? 'hidden' : '';
            var status = megaChatIsReady && megaChat.getPresenceAsCssClass(user.u);

            shareUsersHtml += '<div class="properties-context-item ustatus ' + escapeHTML(userHandle)
                + ' ' + (status || '') + ' ' + hidden + '" data-handle="' + escapeHTML(userHandle) + '">'
                + '<div class="properties-contact-status"></div>'
                + '<span>' + escapeHTML(M.getNameByHandle(userHandle)) + '</span>'
                + '</div>';
        }

        if (users.length > MAX_CONTACTS) {
            shareUsersHtml += '<div class="properties-context-item show-more">'
                + '<span>...' + escapeHTML(l[10663]).replace('[X]', users.length - MAX_CONTACTS) + '</span>'
                + '</div>';
        }

        if (shareUsersHtml !== '') {
            $shareUsers.append(shareUsersHtml);
        }
    }

    /**
     * Gets properties HTML
     * @param {Object} p The properties data
     * @returns {String} Properties HTML
     */
    function getPropertiesContent(p) {
        if  (typeof p !== 'object') {
            return false;
        }

        // Name and path
        let namePathHtml = (is_mobile && !pfcol) ? '' : '<div class="properties-name-container">'
            + '<div class="properties-small-gray">' + p.t1 + '</div>'
            + '<div class="properties-name-block"><div class="propreties-dark-txt">' + p.t2 + '</div>'
            + '</div></div>';

        // Type
        const typehtml = is_mobile && p.t23 ? '<div class="properties-float-bl">'
            + '<span class="properties-small-gray">' + p.t22 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t23 + '</span></div>' : '';

        // Versioning info
        const vhtml = p.versioningFlag
            ?
            '<div class="properties-float-bl' + p.t12 + '"><span class="properties-small-gray">' + p.t13 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t14 + '</span></div>'
            + '<div class="properties-float-bl"><span class="properties-small-gray">' + p.t15 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t16 + '</span></div>'
            + '<div class="properties-float-bl' + p.t17 + '"><span class="properties-small-gray">' + p.t18 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t19 + '</span></div>'
            : '';

        // Modifed or Owner
        const singlenodeinfohtml  = '<div class="properties-float-bl' + p.t5 + ' properties-contains">'
            + '<span class="properties-small-gray">' + p.t6 + '</span>'
            + '<span class="propreties-dark-txt t7">' + p.t7 + '</span></div>';

        // Link created
        const linkcreatedhtml = is_mobile && p.t21 ? '<div class="properties-float-bl">'
            + '<span class="properties-small-gray">' + p.t20 + '</span>'
            + '<span class="propreties-dark-txt t7">' + p.t21 + '</span></div>' : '';

        // Created or Contains
        const shareinfohtml = typeof p.t10 === 'undefined' && typeof p.t11 === 'undefined'
            ? ''
            : '<div class="properties-float-bl"><div class="properties-small-gray t10">' + p.t10 + '</div>'
            + '<div class="propreties-dark-txt t11">' + p.t11 + '</div></div></div>';

        if (pfcol) {
            const {name} = M.getNodeByHandle(p.n.p);

            namePathHtml +=
                `<div class="properties-float-bl">
                    <div class="properties-small-gray">${l.path_lbl}</div>
                    <div class="propreties-dark-txt t7">${escapeHTML(name || '')}</div>
                </div>`;
        }
        else {
            namePathHtml += '<div class="properties-breadcrumb">'
                +     `<div class="properties-small-gray path">${l.path_lbl}</div>`
                +     '<div class="fm-breadcrumbs-wrapper info">'
                +         '<div class="crumb-overflow-link dropdown">'
                +             '<a class="breadcrumb-dropdown-link info-dlg">'
                +                 '<i class="menu-icon sprite-fm-mono icon-options icon24"></i>'
                +             '</a>'
                +             '<i class="sprite-fm-mono icon-arrow-right icon16"></i>'
                +         '</div>'
                +         `<div class="fm-breadcrumbs-block info${is_mobile ? ' location' : ''}"></div>`
                +         '<div class="breadcrumb-dropdown"></div>'
                +     '</div>'
                + '</div>';
        }

        return namePathHtml
            + '<div class="properties-items"><div class="properties-float-bl properties-total-size">'
            + '<span class="properties-small-gray">' + p.t3 + '</span>'
            + '<span class="propreties-dark-txt">' + p.t4 + '</span></div>'
            + typehtml
            + vhtml
            + singlenodeinfohtml
            + '<div class="properties-float-bl">'
            + (p.n.h === M.RootID || p.n.h === M.RubbishID || p.n.h === M.InboxID ?
                '<div class="contact-list-icon sprite-fm-mono icon-info-filled"></div>'
                + '</div>'
                + shareinfohtml :
                '<div class="properties-small-gray">' + p.t8
                + '</div><div class="propreties-dark-txt contact-list">'
                + '<span>' + p.t9 + '</span>'
                + '<div class="contact-list-icon sprite-fm-mono icon-info-filled"></div>'
                + '</div></div>'
                + shareinfohtml
                + linkcreatedhtml);
    }

    /**
     * Gets properties data
     * @param {String|Array} handles Selected node handles {optional}
     * @returns {Object|Boolean} Properties data and strings
     */
    function getNodeProperties(handles) {
        let filecnt = 0;
        let foldercnt = 0;
        let size = 0;
        let sfilecnt = 0;
        let sfoldercnt = 0;
        let vsize = 0;
        let svfilecnt = 0;
        let n;
        const icons = [];
        const selected = [];
        const p = Object.create(null);

        handles = typeof handles === 'string' && [handles] || handles || $.selected || [];

        for (var i = handles.length; i--;) {
            const node = M.getNodeByHandle(handles[i]);

            if (!node) {

                if (d) {
                    console.log('propertiesDialog: invalid node', handles[i]);
                }
                continue;
            }

            n = node;
            icons.push(`item-type-icon-90 icon-${fileIcon(n)}-90`);
            selected.push(handles[i]);

            if (n.t) {
                size += n.tb;// - (n.tvb || 0);
                sfilecnt += n.tf;// - (n.tvf || 0);
                sfoldercnt += n.td;
                foldercnt++;
                vsize += n.tvb || 0;
                svfilecnt += n.tvf || 0;
            }
            else {
                filecnt++;
                size += n.s;
                vsize += n.tvb || 0;
                svfilecnt += n.tvf || 0;
            }
        }

        if (selected.length > 1) {
            n = Object.create(null); // empty n [multiple selection]
        }

        if (!n) {
            return false;
        }

        if (n.tvf) {
            p.versioningFlag = true;

            if (n.rewind) {
                p.fromRewind = true;
            }
        }

        // Hide versioning details temporarily, due to it not working correctly in MEGA Lite / Infinity
        if (mega.lite.inLiteMode) {
            p.versioningFlag = false;
        }

        const exportLink = new mega.Share.ExportLink({});
        p.isTakenDown = exportLink.isTakenDown(selected);
        p.isUndecrypted = missingkeys[n.h];

        if (filecnt + foldercnt === 1) { // one item
            // Favorite icon
            if (n.fav && !folderlink && M.getNodeRoot(n.h) !== M.RubbishID) {
                p.favIcon = ' sprite-fm-mono icon-favourite-filled';
            }
            else if (missingkeys[n.h]) {
                p.favIcon = ' sprite-fm-mono icon-info';
            }

            // Outgoing share
            // @todo: Fix live site issue. Outgoing contacts are never shown
            if (icons.includes('icon-outgoing-90')) {
                p.share = true;
            }

            // Incoming share
            if (typeof n.r === "number") {
                p.zclass = 'read-only';

                if (n.r === 1) {
                    p.zclass = 'read-and-write';
                }
                else if (n.r === 2) {
                    p.zclass = 'full-access';
                }
                p.share = true;
            }

            const user = Object(M.d[n.su || n.p]);
            const shareTs = M.getNodeShare(n).ts;

            if (d) {
                console.log('propertiesDialog', n, user);
            }

            p.t6 = '';
            p.t7 = '';

            if (filecnt) {
                p.t3 = l[5605];
                p.t5 = ' second';

                if (n.mtime) {
                    p.t6 = l[22129];
                    p.t7 = htmlentities(time2date(n.mtime));
                }
            }
            else {
                p.t3 = l[22130];
                p.t5 = '';
            }
            p.t1 = l[1764];

            if (p.isUndecrypted) {
                p.t2 = htmlentities(l[8649]);
            }
            else if (n.name) {
                p.t2 = htmlentities(n.name);
            }
            else if (n.h === M.RootID) {
                p.t2 = htmlentities(l[164]);
            }
            else if (n.h === M.InboxID) {
                p.t2 = htmlentities(l.restricted_folder_button);
            }
            else if (n.h === M.RubbishID) {
                p.t2 = htmlentities(l[167]);
            }

            p.t4 = p.versioningFlag ? bytesToSize(size + vsize) : bytesToSize(size);
            p.t9 = n.ts && htmlentities(time2date(n.ts)) || '';
            p.t8 = p.t9 ? l[22143] : '';
            p.t12 = ' second';
            p.t13 = l[22144];
            p.t14 = mega.icu.format(l.version_count, svfilecnt);
            p.t15 = l[22145];
            p.t16 = bytesToSize(size);
            p.t17 = ' second';
            p.t18 = l[22146];
            p.t19 = bytesToSize(vsize);

            // Link created
            p.t20 = l.link_created_with_colon;
            p.t21 = shareTs && htmlentities(time2date(shareTs)) || '';

            // Item type
            p.t22 = l[22149];
            p.t23 = foldercnt ? l[1049] : filetype(n, 0, 1);

            if (foldercnt) {
                p.t6 = l[22147];
                p.t7 = fm_contains(sfilecnt, sfoldercnt, true);
                p.t15 = l[22148];
                if (p.share) {
                    p.users = M.getSharingUsers(selected, true);

                    // In case that user shares with other
                    // Show contact informations in property dialog
                    if (p.users.length) {
                        p.t8 = l[5611];
                        p.t9 = mega.icu.format(l.contact_count, p.users.length);
                        p.t11 = n.ts ? htmlentities(time2date(n.ts)) : '';
                        p.t10 = p.t11 ? l[6084] : '';
                        p.usersCounter = typeof n.r !== "number" && p.users.length;
                    }
                    else {
                        p.hideContacts = true;
                    }
                }
                if (typeof n.r === "number") {
                    p.t3 = l[5612];
                    let rights = l[55];
                    if (n.r === 1) {
                        rights = l[56];
                    }
                    else if (n.r === 2) {
                        rights = l[57];
                    }
                    p.t4 = rights;
                    p.t6 = l[22157];
                    p.t7 = htmlentities(M.getNameByHandle(user.h));
                    p.t8 = l[22130];
                    p.t9 = p.versioningFlag ? bytesToSize(size + vsize) : bytesToSize(size);
                    p.t10 = l[22147];
                    p.t11 = fm_contains(sfilecnt, sfoldercnt, true);
                }
            }
            if (filecnt && p.versioningFlag && M.currentrootid !== M.RubbishID && !p.fromRewind) {
                p.t14 = '<a id="previousversions">' + p.t14 + '</a>';
            }
        }
        else {
            p.t1 = '';
            p.t2 = '<b>' + fm_contains(filecnt, foldercnt) + '</b>';
            p.t3 = l[22130];
            p.t4 = p.versioningFlag ? bytesToSize(size + vsize) : bytesToSize(size);
            if (foldercnt) {
                p.t5 = '';
                p.t6 = l[22147];
                p.t7 = fm_contains(sfilecnt + filecnt, sfoldercnt + foldercnt, true);
            }
            else {
                p.t5 = ' second';
            }
            p.t8 = l[22149];
            p.t9 = l[1025];
            p.t12 = '';
            p.t13 = l[22144];
            p.t14 = mega.icu.format(l.version_count, svfilecnt);
            p.t15 = l[22148];
            p.t16 = bytesToSize(size);
            p.t17 = '';
            p.t18 = l[22146];
            p.t19 = bytesToSize(vsize);
        }

        return {...p, n, filecnt, foldercnt, icons};
    }

    function _propertiesDialog(action) {
        const update = action === 3;
        const close = !update && action;
        const $dialog = $('.mega-dialog.properties-dialog', '.mega-dialog-container');
        const $icon = $('.properties-file-icon', $dialog);

        $(document).off('MegaCloseDialog.Properties');

        if (close) {
            delete $.propertiesDialog;
            if (close === 2) {
                fm_hideoverlay();
            }
            else {
                closeDialog();
            }
            $('.contact-list-icon').removeClass('active');
            $('.properties-context-menu').fadeOut(200);
            if ($.hideContextMenu) {
                $.hideContextMenu();
            }

            return true;
        }

        $dialog.removeClass('multiple folders-only two-elements shared shared-with-me');
        $dialog.removeClass('read-only read-and-write full-access taken-down undecryptable');
        $dialog.removeClass('hidden-context versioning');
        $('.properties-elements-counter span').text('');

        const p = getNodeProperties();
        const {n, filecnt, foldercnt, icons} = p;

        if (!n) {
            // $.selected had no valid nodes!
            propertiesDialog(1);

            return msgDialog('warninga', l[882], l[24196]);
        }

        if ($.dialog === 'onboardingDialog') {
            closeDialog();
        }

        M.safeShowDialog('properties', () => {
            $.propertiesDialog = 'properties';

            // If it is download page or
            // node is not owned by current user on chat
            // (possible old shared file and no longer exist on cloud-drive, or shared by other user in the chat room),
            // don't display path
            if (page === 'download' || M.chat && n.u !== u_handle
                || !n.h && !M.d[M.currentdirid] || M.isAlbumsPage()) {

                $('.properties-breadcrumb', $dialog).addClass('hidden');
            }
            else {
                // on idle so we can call renderPathBreadcrumbs only once the info dialog is rendered.
                onIdle(() => {
                    // we pass the filehandle, so it is available if we search on files on search
                    M.renderPathBreadcrumbs(
                        n.h, document.querySelector('.properties-breadcrumb .fm-breadcrumbs-wrapper')
                    );
                    mBroadcaster.sendMessage('properties:finish', n.h);
                });
            }
            return $dialog;
        });

        // Set properties data
        $('.properties-txt-pad').safeHTML(getPropertiesContent(p));

        // Hide context menu button
        if (page.substr(0, 7) === 'fm/chat' || n.h === M.RootID || slideshowid || n.h === M.RubbishID) {
            $dialog.addClass('hidden-context');
        }

        if (filecnt + foldercnt === 1) {
            // Show takenDown / undecrypted message
            if (p.isTakenDown || p.isUndecrypted) {
                let notificationText = '';
                if (p.isTakenDown) {
                    $dialog.addClass('taken-down');
                    notificationText = l[7703] + '\n';
                }
                if (p.isUndecrypted) {
                    $dialog.addClass('undecryptable');
                    notificationText += M.getUndecryptedLabel(n);
                }
                showToast('clipboard', notificationText);
            }
        }
        // Adapt UI for multiple selected items
        // @todo: probably remove folder only (?)
        else {
            $dialog.addClass('multiple folders-only');
        }

        // Adapt UI for file versioning
        if (p.versioningFlag) {
            $dialog.addClass('versioning');
        }

        // Adapt UI for outgoing shares
        if (p.share) {
            $dialog.addClass('shared');
        }

        // Add incoming share access icon
        if (p.zclass) {
            $dialog.addClass(`shared shared-with-me ${p.zclass}`);
        }

        // Fill in information about the users with whom the folder was shared
        if (p.users && !p.hideContacts) {
            $('.properties-elements-counter span').text(p.usersCounter || '');
            fillPropertiesContactList($dialog, p.users);
        }

        // Add Favourite icon
        if (p.favIcon) {
            $('.file-status-icon', $dialog).attr('class', 'file-status-icon ' + p.favIcon);
        }

        /* If in MEGA Lite mode for folders, temporarily hide the Total Size and Contains info which isn't known */
        if (mega.lite.inLiteMode && mega.lite.containsFolderInSelection($.selected)) {
            $dialog.addClass('hide-size-and-contains');
        }
        else {
            $dialog.removeClass('hide-size-and-contains');
        }

        if ($dialog.hasClass('shared-with-me') || p.hideContacts) {
            $('.contact-list-icon', '.properties-txt-pad').addClass('hidden');
        }

        $('.properties-body', $dialog).rebind('click', function() {
            // Clicking anywhere in the dialog will close the context-menu, if open
            var $fsi = $('.file-settings-icon', $dialog);
            if ($fsi.hasClass('active')) {
                $fsi.click();
            }

            // Clicking anywhere in the dialog would close the path breadcrumb dropdown if exists and open
            const $pathBreadcrumb = $('.breadcrumb-dropdown', $dialog);
            if ($pathBreadcrumb && $pathBreadcrumb.hasClass('active')) {
                $pathBreadcrumb.removeClass('active');
            }
        });

        if ((filecnt === 1) && (foldercnt === 0)) {
            $('#previousversions').rebind('click', function(ev) {
                mBroadcaster.sendMessage('trk:event', 'properties-dialog', 'click', 'file-version', n);

                if (M.currentrootid !== M.RubbishID) {
                    if (slideshowid) {
                        slideshow(n.h, 1);
                    }
                    fileversioning.fileVersioningDialog(n.h);
                    closeDialog();
                }
            });
        }

        $('button.js-close', $dialog).rebind('click', _propertiesDialog);

        var __fsi_close = function() {
            $dialog.find('.file-settings-icon').removeClass('active');
            $('.dropdown.body').removeClass('arrange-to-front');
            $('.properties-dialog').removeClass('arrange-to-back');
            $('.mega-dialog').removeClass('arrange-to-front');
            $.hideContextMenu();
        };

        $(document).rebind('MegaCloseDialog.Properties', __fsi_close);

        if ($dialog.hasClass('shared')) {
            $('.contact-list-icon').rebind('click', function() {
                if (!$(this).hasClass('active')) {
                    $(this).addClass('active');
                    var $pcm = $('.properties-context-menu');
                    var position = $(this).position();
                    $pcm.css({
                        'left': position.left + 16 + 'px',
                        'top': position.top - $pcm.outerHeight() - 8 + 'px',
                        'transform': 'translateX(-50%)',
                    });
                    $pcm.fadeIn(200);
                }
                else {
                    $(this).removeClass('active');
                    $('.properties-context-menu').fadeOut(200);
                }

                return false;
            });

            $('.properties-dialog').rebind('click', function() {
                var $list = $('.contact-list-icon');
                if ($list.hasClass('active')) {
                    $list.removeClass('active');
                    $('.properties-context-menu').fadeOut(200);
                }
            });

            $('.properties-context-item').rebind('click', function() {
                $('.contact-list-icon').removeClass('active');
                $('.properties-context-menu').fadeOut(200);
                loadSubPage('fm/' + $(this).data('handle'));
                return false;
            });

            // Expands properties-context-menu so rest of contacts can be shown
            // By default only 5 contacts is shown
            $('.properties-context-item.show-more').rebind('click', function() {

                // $('.properties-context-menu').fadeOut(200);
                $('.properties-dialog .properties-context-item')
                    .remove('.show-more')
                    .removeClass('hidden');// un-hide rest of contacts

                var $cli = $('.contact-list-icon');
                var position = $cli.position();
                $('.properties-context-menu').css({
                    'left': position.left + 16 + 'px',
                    'top': position.top - $('.properties-context-menu').outerHeight() - 8 + 'px',
                    'transform': 'translateX(-50%)',
                });
                // $('.properties-context-menu').fadeIn(200);

                return false;// Prevent bubbling
            });
        }

        $icon.text('');

        if (filecnt + foldercnt === 1) {
            mCreateElement('i', {
                'class': icons[0]
            }, $icon[0]);
        }
        else {
            if (filecnt + foldercnt === 2) {
                $dialog.addClass('two-elements');
            }
            $('.properties-elements-counter span', $dialog).text(filecnt + foldercnt);

            var iconsTypes = [];

            for (var j = 0; j < icons.length; j++) {
                var ico = icons[j];

                if (!iconsTypes.includes(ico)) {
                    if (!ico.includes('folder')) {
                        $dialog.removeClass('folders-only');
                    }

                    iconsTypes.push(ico);
                }
            }

            if (icons.length === 2) {
                $dialog.addClass('two-elements');
            }

            for (var k = 0; k < icons.length; k++) {

                if (filecnt && foldercnt || iconsTypes.length > 1) {

                    mCreateElement('i', {
                        'class': `item-type-icon-90 icon-${filecnt ? 'generic' : 'folder'}-90`
                    }, $icon[0]);
                }
                else {

                    mCreateElement('i', {
                        'class': escapeHTML(iconsTypes[0])
                    }, $icon[0]);
                }

                if (k === 2) {
                    break;
                }
            }
        }
    }

    /**
     * @global
     */

    /**
     * Open properties dialog for the selected node(s)
     * @param {Number|Boolean} [close] Whether it should be rather closed.
     * @returns {*|MegaPromise}
     */
    global.propertiesDialog = function propertiesDialog(close) {

        if (close) {
            _propertiesDialog(close);
        }
        else {
            var shares = [];
            var nodes = ($.selected || [])
                .filter(function(h) {
                    if (String(h).length === 11 && M.c[h]) {
                        shares = shares.concat(Object.keys(M.c[h]));
                    }
                    else if (!M.getNodeByHandle(h)) {
                        return true;
                    }
                });
            nodes = nodes.concat(shares);
            var promise = dbfetch.geta(nodes);

            promise.always(function() {
                _propertiesDialog();
            });

            return promise;
        }
    };

    global.getPropertiesContent = getPropertiesContent;
    global.getNodeProperties = getNodeProperties;

})(self);
