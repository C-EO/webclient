import React from 'react';
import { MegaRenderMixin } from '../../mixins.js';
import Stream, { STREAM_ACTIONS, MAX_STREAMS } from './stream.jsx';
import Sidebar from './sidebar.jsx';
import Invite from './workflow/invite/invite.jsx';
import Ephemeral from './workflow/ephemeral.jsx';
import Offline from './offline.jsx';
import { allContactsInChat, excludedParticipants } from '../conversationpanel.jsx';
import StreamControls from './streamControls.jsx';
import SidebarControls from './sidebarControls.jsx';
import Button from './button.jsx';
import ModalDialogsUI from '../../../ui/modalDialogs.jsx';
import { ParsedHTML } from '../../../ui/utils.jsx';
import Link from '../link.jsx';
import { InviteParticipantsPanel } from '../inviteParticipantsPanel.jsx';
import { Dropdown } from '../../../ui/dropdowns.jsx';

const NAMESPACE = 'meetings-call';
export const EXPANDED_FLAG = 'in-call';
const MOUSE_OUT_DELAY = 2500;

/**
 * MODE
 * @description Describes the available call modes.
 * @enum {number}
 * @property {number} THUMBNAIL
 * @property {number} MAIN
 * @readonly
 */

export const MODE = {
    THUMBNAIL: 1,
    MAIN: 2,
    MINI: 3
};

/**
 * VIEW
 * @description Describes the available view states.
 * @enum {number}
 * @property {number} DEFAULT
 * @property {number} CHAT
 * @property {number} PARTICIPANTS
 * @readonly
 */

export const VIEW = {
    DEFAULT: 0,
    CHAT: 1,
    PARTICIPANTS: 2
};

/**
 * TYPE
 * @description Describes the available call types.
 * @type {{VIDEO: number, AUDIO: number}}
 * @enum {number}
 * @property {number} AUDIO
 * @property {number} VIDEO
 * @readonly
 */

export const TYPE = {
    AUDIO: 1,
    VIDEO: 2
};

/**
 * isGuest
 * @description Returns the true if the current user is a guest.
 * @returns {boolean}
 */

export const isGuest = () => !u_type;

/**
 * inProgressAlert
 * @description Renders conditionally message dialog if there is another active call currently. Attached to the
 * audio/video call controls on various places across the UI.
 * @returns {Promise}
 */

export const inProgressAlert = (isJoin, chatRoom) => {
    return new Promise((resolve, reject) => {
        if (megaChat.haveAnyActiveCall()) {
            if (window.sfuClient) {
                // Active call w/ the current client
                const { chatRoom: activeCallRoom } = megaChat.activeCall;
                const peers = activeCallRoom ?
                    activeCallRoom.getParticipantsExceptMe(activeCallRoom.getCallParticipants())
                        .map(h => M.getNameByHandle(h)) :
                    [];
                let body = isJoin ? l.cancel_to_join : l.cancel_to_start;
                if (peers.length) {
                    body = mega.utils.trans.listToString(
                        peers,
                        isJoin ? l.cancel_with_to_join : l.cancel_with_to_start
                    );
                }
                msgDialog('warningb', null, l.call_in_progress, body, null, 1);
                return reject();
            }

            // Active call on another client; incl. current user already being in the call ->
            // skip warning notification
            if (chatRoom.getCallParticipants().includes(u_handle)) {
                return resolve();
            }

            // Active call on another client
            return (
                msgDialog(
                    `warningb:!^${l[2005]}!${isJoin ? l.join_call_anyway : l.start_call_anyway}`,
                    null,
                    isJoin ? l.join_multiple_calls_title : l.start_multiple_calls_title,
                    isJoin ? l.join_multiple_calls_text : l.start_multiple_calls_text,
                    join => {
                        if (join) {
                            return resolve();
                        }
                        return reject();
                    },
                    1
                )
            );
        }
        resolve();
    });
};
window.inProgressAlert = inProgressAlert;

class RecordingConsentDialog extends React.Component {
    static dialogName = `${NAMESPACE}-consent`;

    componentWillUnmount() {
        if ($.dialog && $.dialog === RecordingConsentDialog.dialogName) {
            closeDialog();
        }
    }

    render() {
        const { peers, recorderCid, onCallEnd, onClose } = this.props;
        const recordingPeer = peers[recorderCid];
        const recorderName = nicknames.getNickname(recordingPeer).substr(0, ChatToastIntegration.MAX_NAME_CHARS);

        return (
            <ModalDialogsUI.ModalDialog
                dialogName={RecordingConsentDialog.dialogName}
                className={`
                    mega-dialog
                    dialog-template-message
                    info
                `}
                stopKeyPropagation={true}
                noCloseOnClickOutside={true}>
                <header>
                    <div className="graphic">
                        <i className="info sprite-fm-uni icon-info"/>
                    </div>
                    <div className="info-container">
                        <h3 id="msgDialog-title">{l.call_recorded_heading}</h3>
                        <p className="text">
                            <ParsedHTML>
                                {l.call_recorded_body
                                    .replace(
                                        '[A]',
                                        `<a href="https://mega.io/privacy" target="_blank" class="clickurl">`
                                    )
                                    .replace('[/A]', '</a>')
                                }
                            </ParsedHTML>
                        </p>
                    </div>
                </header>
                <footer>
                    <div className="footer-container">
                        <div className="space-between">
                            <Button
                                className="mega-button"
                                onClick={onCallEnd}>
                                <span>{l[5883]}</span>
                            </Button>
                            <Button
                                className="mega-button positive"
                                onClick={() => {
                                    onClose();
                                    ChatToast.quick(l.user_recording_toast.replace('%NAME', recorderName));
                                }}>
                                <span>{l.ok_button}</span>
                            </Button>
                        </div>
                    </div>
                </footer>
            </ModalDialogsUI.ModalDialog>
        );
    }
}

// --

export default class Call extends MegaRenderMixin {
    domRef = React.createRef();

    recordingConsentDialog = `${NAMESPACE}-consent`;

    ephemeralAddListener = undefined;
    delayProcID = null;
    pCallTimer = null;
    offlineDelayed = undefined;
    callStartTimeout = undefined;

    flagMap = attribCache.bitMapsManager.exists('obv4') ? attribCache.bitMapsManager.get('obv4') : undefined;

    timeoutBannerRef = React.createRef();

    /**
     * STATE
     * @description Object used for handling the default state, incl. storing the previous state on minimizing and
     * expanding the call UI.
     */

    static STATE = {
        DEFAULT: { sidebar: false },
        PREVIOUS: { mode: null, sidebar: null, view: null }
    };

    state = {
        mode: undefined,
        view: VIEW.PARTICIPANTS,
        sidebar: false,
        forcedLocal: false,
        hovered: false,
        invite: false,
        ephemeral: false,
        offline: false,
        ephemeralAccounts: [],
        everHadPeers: false,
        guest: isGuest(),
        waitingRoomPeers: [],
        raisedHandPeers: [],
        raisedHandToast: false,
        initialCallRinging: false,
        onboardingUI: false,
        onboardingRecording: false,
        onboardingRaise: false,
        recorderCid: undefined,
        recordingConsentDialog: false,
        recordingConsented: false,
        recordingActivePeer: undefined,
        recordingTooltip: false,
        invitePanel: false,
        presenterThumbSelected: false,
        timeoutBanner: false,
        showTimeoutUpgrade: false,
        activeElement: false
    };

    /**
     * isModerator
     * @description Given `chatRoom` and `handle` -- returns true if the user is moderator.
     * @param chatRoom {ChatRoom}
     * @param handle {string}
     * @returns {boolean}
     */

    static isModerator = (chatRoom, handle) => {
        if (chatRoom && handle) {
            return chatRoom.members[handle] === ChatRoom.MembersSet.PRIVILEGE_STATE.OPERATOR;
        }
        return false;
    };

    /**
     * isExpanded
     * @description Returns true if the in-call UI is expanded; false when minimized.
     * @returns {boolean}
     */

    static isExpanded = () => document.body.classList.contains(EXPANDED_FLAG);

    /**
     * getUnsupportedBrowserMessage
     * @description Returns conditionally message for unsupported browser; used along w/ feature detection within
     * `megaChat.hasSupportForCalls`. The two message variants concern a) outdated browser version (e.g. Chromium-based)
     * or b) completely unsupported browsers, such as Safari/Firefox.
     * @see megaChat.hasSupportForCalls
     * @see Alert
     * @returns {String}
     */

    static getUnsupportedBrowserMessage = () =>
        navigator.userAgent.match(/Chrom(e|ium)\/(\d+)\./) ?
            l.alert_unsupported_browser_version :
            l.alert_unsupported_browser;

    constructor(props) {
        super(props);
        const { SOUNDS } = megaChat;
        [SOUNDS.RECONNECT, SOUNDS.CALL_END, SOUNDS.CALL_JOIN_WAITING].map(sound => ion.sound.preload(sound));
        this.state.mode = props.call.viewMode;
        this.setOnboarding();
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseOut = this.handleMouseOut.bind(this);
    }

    /**
     * handleMouseMove
     * @description Mouse move event handler -- sets the `hovered` state and removes the hover delay.
     * @returns {void}
     */

    handleMouseMove() {
        this.setState({ hovered: true });
        if (this.delayProcID) {
            delay.cancel(this.delayProcID);
            this.delayProcID = null;
        }
    }

    /**
     * handleMouseOut
     * @description Mouse out event handler -- removes the `hovered` state and adds delay listener.
     * @returns {void}
     */

    handleMouseOut() {
        if (this.state.hovered) {
            this.delayProcID =
                delay('meetings-call-hover', () => {
                    if (this.isMounted()) {
                        // when ending a call, the component may be unmounted on hover, because of the delay ^
                        this.setState({ hovered: false });
                    }
                }, MOUSE_OUT_DELAY);
        }
    }

    /**
     * handleReconnectTimeout
     * @description Invoked after the call have been retrying to reconnect for ~30 seconds.
     * @see render
     * @see Offline
     */

    handleRetryTimeout = () => {
        const { call, chatRoom } = this.props;
        if (call?.sfuClient.connState === SfuClient.ConnState.kDisconnectedRetrying) {
            this.handleCallEnd();
            chatRoom.trigger('onRetryTimeout');
            megaChat.playSound(megaChat.SOUNDS.CALL_END);
        }
    };

    /**
     * handleCallOffline
     * @description Invoked on `offline` event, handles the offline state. If the user have been ~30 seconds offline,
     * displays a dialog w/ relevant copy and actions.
     * @see Offline
     */

    handleCallOffline() {
        if (!this.pCallTimer) {
            (this.pCallTimer = tSleep(30))
                .then(() => {
                    this.setState({ offline: true });
                });
        }
    }

    /**
     * handleCallOnline
     * @description Invoked on join and after coming back online. Resets the `offline` state if it was already set,
     * populates the list of peers with raised hands (if any).
     * @see Offline
     */

    handleCallOnline = () => {
        if (this.pCallTimer) {
            this.pCallTimer.abort();
            this.pCallTimer = null;
        }
        this.setState({ offline: false, raisedHandPeers: [...this.props.call.sfuClient.raisedHands] });
    };

    // Force as always visible.
    customIsEventuallyVisible = () => true;

    setOnboarding() {
        // TODO: refactor and transition to `ChatOnboarding`
        this.state.onboardingUI =
            this.state.hovered = this.flagMap && !this.flagMap.getSync(OBV4_FLAGS.CHAT_CALL_UI);
        if (!this.state.onboardingUI) {
            this.state.onboardingRecording = this.state.hovered =
                this.flagMap && !this.flagMap.getSync(OBV4_FLAGS.CHAT_CALL_RECORDING);
        }
        if (!this.state.onboardingUI && !this.state.onboardingRecording) {
            this.state.onboardingRaise = this.state.hovered =
                this.flagMap && !this.flagMap.getSync(OBV4_FLAGS.CHAT_CALL_RAISE);
        }
    }

    renderRaisedHandToast = () => {
        const { raisedHandPeers } = this.state;
        window.toaster.main.hideAll();
        toaster.main.show({
            buttons: [{
                text: l[16797] /* `View` */,
                onClick: () =>
                    this.setState(
                        { sidebar: true, view: VIEW.PARTICIPANTS, raisedHandToast: false },
                        () => window.toaster.main.hideAll()
                    )
            }],
            onClose: () => this.setState({ raisedHandToast: false }, ()=>window.toaster.main.hideAll()),
            classes: ['theme-dark-forced', 'call-toast'],
            icons: ['sprite-fm-uni icon-raise-hand'],
            timeout: 0 /* No auto hiding */,
            content: (() => {
                const peerName = M.getNameByHandle(raisedHandPeers[0]);
                const peersCount = raisedHandPeers.length;
                const withCurrentPeer = raisedHandPeers.includes(u_handle);
                const CONTENT = {
                    1: () =>
                        // `${NAME} raised their hand`
                        l.raise_peer_raised.replace('%s', peerName),
                    2: () => {
                        // `You and 1 other raised their hand` || `${NAME} and 1 other raised their hand`
                        const message = withCurrentPeer ? l.raise_self_peers_raised : l.raise_two_raised;
                        return mega.icu.format(message, peersCount - 1).replace('%s', peerName);
                    },
                    rest: () => {
                        // `You and N people raised their hand` || `N people raised their hand`
                        const message = withCurrentPeer ? l.raise_self_peers_raised : l.raise_peers_raised;
                        return mega.icu.format(message, withCurrentPeer ? peersCount - 1 : peersCount);
                    }
                };
                return (CONTENT[peersCount] || CONTENT.rest)();
            })()
        });
    };

    /**
     * bindCallEvents
     * @description Binds event handlers related to the `Local` and `Call` components.
     * `onCallPeerLeft`/`onCallPeerJoined` set the call mode depending on the number of participants
     * and show the call timeout dialog when the last peer leaves or resets that state on peer joined;
     * `onCallEnd` unmounts `Local` when the current room is not active and the in-call UI is minimized.
     * @see Local
     * @see MODE
     */

    bindCallEvents = () => {
        const { chatRoom } = this.props;

        chatRoom.rebind(`onCallPeerLeft.${NAMESPACE}`, (ev, { userHandle, clientId }) => {
            const { minimized, peers, call, chatRoom } = this.props;

            // Recording peer dropped the call -> notify all peers and update the state to reflect that
            if (clientId === this.state.recorderCid) {
                chatRoom.trigger('onRecordingStopped', { userHandle, clientId });
            }

            if (minimized) {
                this.setState({ mode: peers.length === 0 ? MODE.THUMBNAIL : MODE.MINI }, () => {
                    call.setViewMode(this.state.mode);
                });
            }
        });

        chatRoom.rebind(`onCallPeerJoined.${NAMESPACE}`, () => {
            const { minimized, peers, call } = this.props;

            if (minimized) {
                this.setState({ mode: peers.length === 0 ? MODE.THUMBNAIL : MODE.MINI }, () => {
                    call.setViewMode(this.state.mode);
                });
            }

            if (call.hasOtherParticipant()) {
                if (!this.state.everHadPeers) {
                    this.setState({ everHadPeers: true });
                }
                clearTimeout(this.callStartTimeout);
            }
        });

        chatRoom.rebind(`onCallLeft.${NAMESPACE}`, () => this.props.minimized && this.props.onCallEnd());

        // --

        chatRoom.rebind(`wrOnUsersEntered.${NAMESPACE}`, (ev, users) =>
            Object.entries(users).forEach(([handle, host]) => {
                return host || this.state.waitingRoomPeers.includes(handle) ?
                    null :
                    // Add peer to the waiting room; play sound notification with the first peer that entered
                    // the waiting queue.
                    this.isMounted() &&
                    this.setState(
                        { waitingRoomPeers: [...this.state.waitingRoomPeers, handle] },
                        () => {
                            const { waitingRoomPeers } = this.state;
                            if (waitingRoomPeers && waitingRoomPeers.length === 1) {
                                megaChat.playSound(megaChat.SOUNDS.CALL_JOIN_WAITING);
                            }
                            mBroadcaster.sendMessage('meetings:peersWaiting', waitingRoomPeers);
                        }
                    );
            })
        );

        // Remove peers from the waiting room once they're admitted
        const usrwr = (e, users) => {
            users = typeof users === 'string' ? [users] : users;
            return (
                this.isMounted() &&
                this.setState(
                    { waitingRoomPeers: this.state.waitingRoomPeers.filter(h => !users.includes(h)) },
                    () => mBroadcaster.sendMessage('meetings:peersWaiting', this.state.waitingRoomPeers)
                )
            );
        };
        chatRoom.rebind(`wrOnUserLeft.${NAMESPACE}`, usrwr);
        chatRoom.rebind(`wrOnUsersAllow.${NAMESPACE}`, usrwr);

        chatRoom.rebind(`wrOnUserDump.${NAMESPACE}`, (ev, users) =>
            Object.entries(users).forEach(([handle, host]) => {
                return host || this.state.waitingRoomPeers.includes(handle) ?
                    null :
                    this.isMounted() && this.setState({ waitingRoomPeers: [...this.state.waitingRoomPeers, handle] });
            })
        );

        // --

        chatRoom.rebind(`onRecordingStarted.${NAMESPACE}`, (ev, { userHandle, clientId }) => {
            if (!this.state.recorderCid) {
                return (
                    this.state.recordingConsented ?
                        this.setState({ recorderCid: clientId }, () => {
                            ChatToast.quick(
                                l.user_recording_toast.replace(
                                    '%NAME',
                                    nicknames.getNickname(userHandle).substr(0, ChatToastIntegration.MAX_NAME_CHARS)
                                )
                            );
                        }) :
                        (() => {
                            closeDialog();
                            M.safeShowDialog(
                                RecordingConsentDialog.dialogName,
                                () => this.setState({ recorderCid: clientId, recordingConsentDialog: true })
                            );
                        })()
                );
            }
        });

        chatRoom.rebind(`onRecordingStopped.${NAMESPACE}`, (ev, { userHandle, clientId }) => {
            const { recorderCid } = this.state;
            this.setState(
                { recordingConsentDialog: false, recorderCid: clientId === recorderCid ? false : recorderCid },
                () =>
                    window.sfuClient &&
                    clientId === recorderCid &&
                    ChatToast.quick(
                        l.user_recording_nop_toast
                            .replace(
                                '%NAME',
                                nicknames.getNickname(userHandle).substr(0, ChatToastIntegration.MAX_NAME_CHARS)
                            )
                    )
            );
        });

        // --

        chatRoom.rebind(`onMutedBy.${NAMESPACE}`, (ev, { cid }) => {
            megaChat.plugins.userHelper.getUserNickname(this.props.peers[cid]).catch(dump).always(name => {
                ChatToast.quick(
                    /* `You've been muted by %NAME` */
                    l.muted_by.replace('%NAME', name || '')
                );
            });
        });

        // --

        chatRoom.rebind(`onCallEndTimeUpdated.${NAMESPACE}`, ({ data }) => {
            this.setState(
                {
                    timeoutBanner: !!data,
                    showTimeoutUpgrade: (this.props.call.organiser === u_handle) && (data - Date.now() >= 120e3)
                },
                () => {
                    if (this.state.timeoutBanner) {
                        this.timeoutBannerInterval = this.timeoutBannerInterval ||
                            setInterval(() => this.updateTimeoutDuration(), 1000);
                    }
                    else {
                        clearInterval(this.timeoutBannerInterval);
                        delete this.timeoutBannerInterval;
                    }
                }
            );
        });

        // --

        chatRoom.rebind(`onRaisedHandAdd.${NAMESPACE}`, (ev, { userHandle }) =>
            this.isMounted() &&
            this.setState(state => ({ raisedHandPeers: [...state.raisedHandPeers, userHandle] }), () => {
                const { raisedHandPeers } = this.state;
                if (userHandle !== u_handle && !this.props.minimized) {
                    this.setState({ raisedHandToast: true }, () => this.renderRaisedHandToast());
                }
                // [...] TODO: abstract into HOC, consumed in `participants.jsx`,`float.jsx`, `videoNode.jsx`
                mBroadcaster.sendMessage('meetings:raisedHand', raisedHandPeers);
            })
        );

        chatRoom.rebind(`onRaisedHandDel.${NAMESPACE}`, (ev, { userHandle }) =>
            this.isMounted() &&
            this.setState(
                state => ({ raisedHandPeers: state.raisedHandPeers.filter(h => h !== userHandle) }),
                () => {
                    const { raisedHandPeers, raisedHandToast } = this.state;
                    // [...] TODO: abstract into HOC, consumed in `participants.jsx`,`float.jsx`, `videoNode.jsx`
                    mBroadcaster.sendMessage('meetings:raisedHand', raisedHandPeers);
                    if (raisedHandPeers && raisedHandPeers.length) {
                        // Update the toaster once a peer removes their raised hand if the toaster is currently shown
                        return raisedHandToast ? this.renderRaisedHandToast() : null;
                    }
                    // Last peer removed their raised hand -> hide the toaster
                    return this.setState({ raisedHandToast: false }, ()=>window.toaster.main.hideAll());
                }
            )
        );

        chatRoom.rebind(
            `onRecordingActivePeer.${NAMESPACE}`,
            (ev, { userHandle }) => this.setState({ recordingActivePeer: userHandle })
        );
    };

    unbindCallEvents = () =>
        [
            'onCallPeerLeft',
            'onCallPeerJoined',
            'onCallLeft',
            'wrOnUsersAllow',
            'wrOnUsersEntered',
            'wrOnUserLeft',
            'alterUserPrivilege',
            'onCallState',
            'onRecordingStarted',
            'onRecordingStopped',
            'onRecordingActivePeer',
            'onCallEndTimeUpdated',
            'onRaisedHandAdd',
            'onRaisedHandDel',
        ]
            .map(event => this.props.chatRoom.off(`${event}.${NAMESPACE}`));

    /**
     * handleCallMinimize
     * @description Handles the minimize behavior for the call UI. Stores the current state, so it's restored after
     * expanding back the call UI.
     * @see handleCallExpand
     * @see ConversationPanel.toggleCallFlag
     * @returns {void|function}
     */

    handleCallMinimize = () => {
        const { call, peers, onCallMinimize } = this.props;
        const { mode, sidebar, view } = this.state;
        const { callToutId, stayOnEnd, presenterStreams } = call;
        // Cache previous state only when `Local` is not already minimized
        Call.STATE.PREVIOUS = mode !== MODE.MINI ? { mode, sidebar, view } : Call.STATE.PREVIOUS;
        const doMinimize = () => {
            onCallMinimize();
            window.toaster.main.hideAll();
        };
        // Close node info panel when open
        mega.ui.mInfoPanel.hide();

        return (
            peers.length > 0 || presenterStreams.has(u_handle) ?
                // There are peers, i.e. other call participants -> render `Local` in `mini mode`
                this.setState({ mode: MODE.MINI, sidebar: false }, () => {
                    doMinimize();
                    call.setViewMode(MODE.MINI);
                }) :
                (() => {
                    doMinimize();
                    // The call has one participant only (i.e. me) -> render `Local` in `self-view` mode
                    if (typeof callToutId !== 'undefined' && !stayOnEnd) {
                        onIdle(() => call.showTimeoutDialog());
                    }
                })()
        );
    };

    /**
     * handleCallExpand
     * @description Handles the expand behavior for the call UI. Restores the state that was cached prior to
     * minimizing the call UI.
     * @see handleCallMinimize
     * @see ConversationPanel.toggleCallFlag
     * @returns {Promise} Returns promise once the state is updated.
     */

    handleCallExpand = async() => {
        // Close node info panel when open
        mega.ui.mInfoPanel.hide();

        return new Promise((resolve) => {
            this.setState({ ...Call.STATE.PREVIOUS }, () => {
                this.props.onCallExpand();
                resolve();
            });
        });
    };

    /**
     * handleStreamToggle
     * @description Temporary debug method used to add or remove fake peers.
     * @param {number} action flag indicating the toggle action
     * @returns {void|boolean}
     */

    handleStreamToggle = action => {
        const { peers } = this.props;

        if (action === STREAM_ACTIONS.ADD && peers.length === MAX_STREAMS) {
            return;
        }

        return action === STREAM_ACTIONS.ADD ? peers.addFakeDupStream() : peers.removeFakeDupStream();
    };

    /**
     * handleSpeakerChange
     * @description Handles the selection of active speaker when in `Main Mode`.
     * @param {Peer} peer the peer whose stream to pin
     * @param {boolean} [presenterThumbSelected] If the node being changed to should be the thumbnail of the presenter.
     * @see ParticipantsBlock
     * @see Local.renderOptionsDialog
     * @see VideoNodeMenu.Pin
     * @returns {void}
     */

    handleSpeakerChange = (source, presenterThumbSelected) => {
        if (source) {
            this.handleModeChange(MODE.MAIN);
            const sourceId = source.isLocal ? 0 : source.clientId;
            if (sourceId !== this.props.call.pinnedCid) {
                this.props.call.setPinnedCid(sourceId);
            }
            else {
                this.props.call.setPinnedCid(
                    sourceId,
                    !source.hasScreen || presenterThumbSelected === this.state.presenterThumbSelected
                );
            }

            const { pinnedCid } = this.props.call;
            this.setState({
                forcedLocal: !!(source.isLocal && pinnedCid !== null),
                presenterThumbSelected: pinnedCid === null ? false : !!presenterThumbSelected && source.hasScreen,
            });
        }
        else if (source === null) {
            this.setState({ presenterThumbSelected: !!presenterThumbSelected });
        }
    };

    /**
     * handleModeChange
     * @description Sets the selected call mode (`Thumbnail`/`Main`).
     * @see MODE
     * @see ModeSwitch
     * @param {MODE} mode flag indicating the selected call mode
     * @returns {void}
     */

    handleModeChange = mode => {
        this.props.call.setViewMode(mode);
        this.setState({ mode, forcedLocal: false });
    };

    /**
     * handleChatToggle
     * @description Toggles the chat in the `Sidebar`.
     * @see Sidebar.renderChatView
     * @see SidebarControls
     * @returns {void}
     */

    handleChatToggle = () => {
        if (this.state.sidebar && this.state.view === VIEW.CHAT) {
            return this.setState({ ...Call.STATE.DEFAULT });
        }
        return this.setState({ sidebar: true, view: VIEW.CHAT });
    };

    /**
     * handleParticipantsToggle
     * @description Toggles the participants list in the `Sidebar`.
     * @see Sidebar.renderParticipantsView
     * @see SidebarControls
     * @param [forceOpen] If the sidebar should be forced open on VIEW.PARTICIPANTS
     * @returns {void}
     */

    handleParticipantsToggle = (forceOpen) => {
        if (forceOpen !== true) {
            forceOpen = false;
        }
        if (this.state.sidebar && this.state.view === VIEW.CHAT) {
            return this.setState({ sidebar: true, view: VIEW.PARTICIPANTS });
        }
        return this.setState({ sidebar: forceOpen ? true : !this.state.sidebar, view: VIEW.PARTICIPANTS });
    };

    /**
     * handleInviteToggle
     * @description Toggles the `Invite` dialog.
     * @see Invite
     * @see Sidebar.renderHead
     * @see Stream.renderStreamContainer
     * @returns {void}
     */

    handleInviteToggle = () => {
        if (Object.values(M.u.toJS()).some(u => u.c === 1)) {
            const participants = excludedParticipants(this.props.chatRoom);

            if (allContactsInChat(participants)) {
                msgDialog(
                    `confirmationa:!^${l[8726]}!${l[82]}`,
                    null,
                    `${l.all_contacts_added}`,
                    `${l.all_contacts_added_to_chat}`,
                    (res) => {
                        if (res) {
                            contactAddDialog(null, false);
                        }
                    }
                );
            }
            else {
                this.setState({ invite: !this.state.invite });
            }
        }
        else {
            msgDialog(// new user adding a partcipant
                `confirmationa:!^${l[8726]}!${l[82]}`,
                null,
                `${l.no_contacts}`,
                `${l.no_contacts_text}`,
                (resp) => {
                    if (resp) {
                        contactAddDialog(null, false);
                    }
                }
            );
        }
    };

    handleInvitePanelToggle() {
        delay('chat-event-inv-call', () => eventlog(99962));
        this.setState({ invitePanel: !this.state.invitePanel });
    }

    /**
     * handleHoldToggle
     * @description Handles the on hold behavior. Sends `mBroadcaster` message to `Stream` where the
     * grid is recalculated.
     * @see Stream.callHoldListener
     * @returns {void}
     */

    handleHoldToggle = async() => {
        await this.props.call.toggleHold();
        mBroadcaster.sendMessage('meetings:toggleHold');
    };

    /**
     * handleScreenSharingToggle
     * @description Handles the screen sharing behavior. Includes temporary check targeting Chrome 92, due recent bug
     * affecting screen sharing.
     * @returns {Promise|void}
     */

    handleScreenSharingToggle = () => {
        const { call } = this.props;
        const userAgent = navigator.userAgent.match(/Chrom(e|ium)\/(\d+)\./);
        const version = parseInt(userAgent[2], 10);

        if (version === 92) {
            return msgDialog('info', undefined, l[47], l.chrome_screensharing);
        }

        return call.toggleScreenSharing();
    };

    /**
     * handleCallEnd
     * @description Handles the call end behavior
     * @returns {void}
     */

    handleCallEnd = () => {
        // Close node info panel when open
        mega.ui.mInfoPanel.hide();
        this.props.call?.destroy(SfuClient.TermCode.kUserHangup);
    };

    /**
     * handleEphemeralAdd
     * @description Handles the `Add Contact` behavior specific to ephemeral accounts. Keeps track of the user
     * handles of the ephemeral accounts on which the `Add contact` was invoked on, and displays info dialog.
     * @param {string} handle the user handle of the account on which `Add Contact` was fired on
     * @see Ephemeral
     * @see VideoNodeMenu.Contact
     * @returns {false|void}
     */

    handleEphemeralAdd = handle =>
        handle && this.setState(state => ({
            ephemeral: true,
            ephemeralAccounts: [...state.ephemeralAccounts, handle]
        }));

    handleStayConfirm = () => {
        const { call } = this.props;
        call.handleStayConfirm();
        onIdle(() => this.safeForceUpdate());
    };

    handleRecordingToggle = () => {
        const { call, chatRoom } = this.props;
        if (chatRoom.isMeeting) {
            eventlog(500286);
        }
        else {
            eventlog(500287);
        }

        if (this.state.recorderCid) {
            return (
                msgDialog(
                    `confirmation:!^${l.stop_recording_dialog_cta}!${l.stop_recording_nop_dialog_cta}`,
                    undefined,
                    l.stop_recording_dialog_heading,
                    l.stop_recording_dialog_body,
                    cb => cb && sfuClient.recordingStop(),
                    1
                )
            );
        }

        msgDialog(
            `warningb:!^${l.start_recording_dialog_cta}!${l[82]}`,
            null,
            l.notify_participants_dialog_heading,
            l.notify_participants_dialog_body,
            cb => {
                if (cb || cb === null) {
                    return;
                }
                call.sfuClient.recordingStart(this.onWeStoppedRecording)
                    .then(() => {
                        call.recorderCid = this.state.recorderCid;
                        this.setState({ recorderCid: call.sfuClient.cid });
                        this.handleModeChange(MODE.MAIN);
                        call.recordActiveStream();
                        ChatToast.quick(l.started_recording_toast);
                    })
                    .catch(dump);
            },
            1
        );
    };

    onWeStoppedRecording = err =>
        this.isMounted() &&
        this.setState(
            { recorderCid: undefined, recordingActivePeer: undefined },
            () => err ?
                ChatToast.quick(`${l.stopped_recording_toast} Error: ${err.message || err}`) :
                ChatToast.quick(l.stopped_recording_toast)
        );

    handleInviteOrAdd() {
        const { chatRoom } = this.props;
        if (chatRoom.type === 'group') {
            return this.handleInviteToggle();
        }
        loadingDialog.show('fetchchatlink');
        chatRoom.updatePublicHandle(false, false, true).catch(dump).always(() => {
            loadingDialog.hide('fetchchatlink');
            if (!this.isMounted()) {
                return;
            }
            if (!chatRoom.iAmOperator() && chatRoom.options[MCO_FLAGS.OPEN_INVITE] && !chatRoom.publicLink) {
                this.handleInviteToggle();
            }
            else if (chatRoom.type === 'public' && !chatRoom.topic) {
                this.handleInviteToggle();
            }
            else {
                this.handleInvitePanelToggle();
            }
        });
    }

    renderRecordingControl = () => {
        const { chatRoom, call, peers } = this.props;
        const { recorderCid, recordingTooltip, recordingActivePeer } = this.state;
        const isModerator = Call.isModerator(chatRoom, u_handle);
        const $$CONTAINER = ({ className, onClick, children }) =>
            <div
                className={`
                    recording-control
                    ${localStorage.callDebug ? 'with-offset' : ''}
                    ${className || ''}
                `}
                onClick={onClick}>
                {children}
            </div>;

        if (recorderCid) {
            const isRecorder = isModerator && recorderCid === call.sfuClient.cid;
            const recordingPeer = peers[recorderCid];

            return (
                <$$CONTAINER
                    recordingTooltip={recordingTooltip}
                    className="recording-fixed">
                    <div
                        className={`
                            recording-ongoing
                            simpletip
                            ${isRecorder ? '' : 'plain-background'}
                        `}
                        {...(recorderCid !== call.sfuClient.cid && {
                            'data-simpletip': l.host_recording.replace(
                                '%NAME',
                                nicknames.getNickname(recordingPeer) ||
                                megaChat.plugins.userHelper.SIMPLETIP_USER_LOADER
                            ),
                            'data-simpletipposition': 'top',
                            'data-simpletipoffset': 5,
                            'data-simpletip-class': 'theme-dark-forced'
                        })}>
                        <span
                            className={`
                                recording-icon
                                button
                                ${recordingTooltip ? 'active-dropdown' : ''}
                                ${isRecorder ? 'clickable' : ''}
                            `}
                            onMouseEnter={() => isRecorder && this.setState({ recordingTooltip: true })}
                            onMouseOut={() =>
                                isRecorder &&
                                delay(
                                    'meetings-rec-hover',
                                    () => this.setState({ recordingTooltip: false }),
                                    MOUSE_OUT_DELAY / 2
                                )
                            }>
                            REC <i/>
                            <Dropdown
                                className="recording-info theme-dark-forced"
                                active={recordingTooltip}
                                noArrow={false}
                                positionMy="center top"
                                positionAt="center bottom"
                                vertOffset={40}
                                horizOffset={30}>
                                <div>Currently recording: {nicknames.getNickname(recordingActivePeer)}</div>
                            </Dropdown>
                        </span>
                        {isRecorder &&
                            <span
                                className="recording-toggle"
                                onClick={this.handleRecordingToggle}>
                                {l.record_stop_button /* `Stop recording` */}
                            </span>
                        }
                    </div>
                </$$CONTAINER>
            );
        }

        const isOnHold = !!(call?.av & Av.onHold);
        return (
            isModerator &&
            <$$CONTAINER
                className={isOnHold ? 'disabled' : ''}
                onClick={() => {
                    this.setState({ onboardingRecording: false, hovered: false }, () => {
                        this.flagMap.setSync(OBV4_FLAGS.CHAT_CALL_RECORDING, 1);
                        this.flagMap.safeCommit();
                    });
                    return (
                        isOnHold ||
                        recorderCid && recorderCid !== call.sfuClient.cid ? null : this.handleRecordingToggle()
                    );
                }}>
                <Button
                    className={`
                        mega-button
                        theme-dark-forced
                        call-action
                        round
                        recording-start
                        ${isOnHold ? 'disabled' : ''}
                    `}>
                    <div>
                        <i/>
                    </div>
                </Button>
                <span className="record-label">{l.record_start_button /* `Record` */}</span>
            </$$CONTAINER>
        );
    };

    renderTimeLimitBanner() {
        return (
            <div className="call-time-limit-banner theme-dark-forced">
                <span ref={this.timeoutBannerRef}>{this.timeoutString}</span>
                <span
                    className="call-limit-banner-action"
                    onClick={() => {
                        clearInterval(this.timeoutBannerInterval);
                        delete this.timeoutBannerInterval;
                        this.setState({ timeoutBanner: false });
                    }}>
                    {l[2005]}
                </span>
                {
                    this.state.showTimeoutUpgrade &&
                    <Link
                        className="call-limit-banner-action"
                        onClick={() => {
                            window.open(`${getBaseUrl()}/pro`, '_blank', 'noopener,noreferrer');
                            eventlog(500262);
                        }}>
                        {l.upgrade_now}
                    </Link>
                }
            </div>
        );
    }

    get timeoutString() {
        const { call } = this.props;
        if (call.callEndTime === 0) {
            return '';
        }
        const remainSeconds = Math.max(0, Math.ceil((call.callEndTime - Date.now()) / 1000));
        if (call.organiser === u_handle) {
            if (remainSeconds < 60) {
                /* `# second(s) left in your free MEGA call. Wrap up your call to avoid disruption` */
                return mega.icu.format(l.free_call_banner_organiser_ending_sec, remainSeconds);
            }
            if (remainSeconds <= 120) {
                /* `# minute(s) left in your free MEGA call. Wrap up your call to avoid disruption` */
                return mega.icu.format(l.free_call_banner_organiser_ending, Math.ceil(remainSeconds / 60));
            }
            /* `Your free call will end in # minute(s). Need more time? Check our plans` */
            return mega.icu.format(l.free_call_banner_organiser_warning, Math.ceil(remainSeconds / 60));
        }
        if (remainSeconds < 60) {
            /* `# second(s) left in this free MEGA call. Wrap up your call to avoid disruption` */
            return mega.icu.format(l.free_call_banner_ending_sec, remainSeconds);
        }
        if (remainSeconds <= 120) {
            /* `# minute(s) left in this free MEGA call. Wrap up your call to avoid disruption` */
            return mega.icu.format(l.free_call_banner_ending, Math.ceil(remainSeconds / 60));
        }
        /* `This free call will end in # minute(s)` */
        return mega.icu.format(l.free_call_banner_warning, Math.ceil(remainSeconds / 60));
    }

    updateTimeoutDuration() {
        if (this.timeoutBannerRef) {
            const { current } = this.timeoutBannerRef;
            const newStr = this.timeoutString;
            if (newStr && current && current.innerText !== newStr) {
                current.innerText = newStr;
            }
            if (this.state.showTimeoutUpgrade && this.props.call.callEndTime - Date.now() <= 12e4) {
                this.setState({ showTimeoutUpgrade: false });
            }
        }
    }

    setActiveElement = activeElement => this.setState({ activeElement });

    componentWillUnmount() {
        super.componentWillUnmount();
        const { minimized, willUnmount, chatRoom } = this.props;

        chatRoom.megaChat.off(`sfuConnClose.${NAMESPACE}`);
        chatRoom.megaChat.off(`sfuConnOpen.${NAMESPACE}`);
        chatRoom.megaChat.off(`onSpeakerChange.${NAMESPACE}`);
        chatRoom.megaChat.off(`onPeerAvChange.${NAMESPACE}`);

        mBroadcaster.removeListener(this.ephemeralAddListener);
        mBroadcaster.removeListener(this.pageChangeListener);

        clearTimeout(this.callStartTimeout);
        delay.cancel('callOffline');

        if ($.dialog) {
            closeDialog();
        }

        if (this.timeoutBannerInterval) {
            clearInterval(this.timeoutBannerInterval);
        }

        window.toaster.main.hideAll();
        this.unbindCallEvents();
        willUnmount?.(minimized);
    }

    componentDidMount() {
        super.componentDidMount();
        const { call, didMount, chatRoom } = this.props;

        this.ephemeralAddListener =
            mBroadcaster.addListener('meetings:ephemeralAdd', handle => this.handleEphemeralAdd(handle));

        this.pageChangeListener = mBroadcaster.addListener('pagechange', () => {
            const currentRoom = megaChat.getCurrentRoom();
            if (Call.isExpanded() && (!M.chat || currentRoom && currentRoom.chatId !== chatRoom.chatId)) {
                this.handleCallMinimize();
            }
        });

        chatRoom.megaChat.rebind(`sfuConnOpen.${NAMESPACE}`, () => this.handleCallOnline());
        chatRoom.megaChat.rebind(`sfuConnClose.${NAMESPACE}`, () => this.handleCallOffline());
        chatRoom.rebind(`onCallState.${NAMESPACE}`, (ev, { arg }) => this.setState({ initialCallRinging: arg }));
        const {tresizer} = $;
        chatRoom.rebind(`onPeerAvChange.${NAMESPACE}`, tresizer);
        chatRoom.rebind(`onSpeakerChange.${NAMESPACE}`, tresizer);

        this.callStartTimeout = setTimeout(() => {
            if (!mega.config.get('callemptytout') && !call.hasOtherParticipant()) {
                call.left = true;
                call.initCallTimeout();
            }
        }, 6e4 * 5 /* 5 minutes */);

        setTimeout(() =>
            call.peers?.length && !call.hasOtherParticipant() && this.setState({ everHadPeers: true }), 2e3
        );

        if (sessionStorage.previewMedia) {
            const { audio, video } = JSON.parse(sessionStorage.previewMedia);
            sessionStorage.removeItem('previewMedia');
            tSleep(2)
                .then(() => audio && call.sfuClient.muteAudio())
                .then(() => video && call.sfuClient.muteCamera())
                .catch(dump);
        }

        this.bindCallEvents();
        didMount?.();
    }

    render() {
        const {
            minimized, peers, call, chatRoom, parent, typingAreaText,
            onDeleteMessage, onTypingAreaChanged
        } = this.props;
        const {
            mode, view, sidebar, hovered, forcedLocal, invite, ephemeral, ephemeralAccounts, guest,
            offline, onboardingUI, onboardingRecording, onboardingRaise, everHadPeers, initialCallRinging,
            waitingRoomPeers, recorderCid, raisedHandPeers, recordingConsentDialog, invitePanel, presenterThumbSelected,
            timeoutBanner, activeElement
        } = this.state;
        const { stayOnEnd } = call;
        const hasOnboarding = onboardingUI || onboardingRecording || onboardingRaise;
        const STREAM_PROPS = {
            mode, peers, sidebar, hovered: hasOnboarding || hovered, forcedLocal, call, view, chatRoom, parent,
            stayOnEnd, everHadPeers, waitingRoomPeers, recorderCid, presenterThumbSelected, raisedHandPeers,
            activeElement, hasOtherParticipants: call.hasOtherParticipant(), isOnHold: call.sfuClient.isOnHold,
            isFloatingPresenter: (mode === MODE.MINI && !forcedLocal ? call.getActiveStream() : call.getLocalStream())
                ?.hasScreen,
            onSpeakerChange: this.handleSpeakerChange, onModeChange: this.handleModeChange,
            onInviteToggle: this.handleInviteToggle, onStayConfirm: this.handleStayConfirm
        };

        //
        // `Call`
        // -------------------------------------------------------------------------

        return (
            <div
                ref={this.domRef}
                className={`
                    meetings-call
                    ${minimized ? 'minimized' : ''}
                    ${timeoutBanner ? 'with-timeout-banner' : ''}
                    ${activeElement ? 'with-active-element' : ''}
                `}
                onMouseMove={hasOnboarding ? null : this.handleMouseMove}
                onMouseOut={hasOnboarding ? null : this.handleMouseOut}>

                {timeoutBanner && this.renderTimeLimitBanner()}

                <Stream
                    {...STREAM_PROPS}
                    minimized={minimized}
                    ephemeralAccounts={ephemeralAccounts}
                    onCallMinimize={this.handleCallMinimize}
                    onCallExpand={this.handleCallExpand}
                    onCallEnd={this.handleCallEnd}
                    onStreamToggle={this.handleStreamToggle}
                    onRecordingToggle={() =>
                        // TODO: method instead a prop
                        call.sfuClient.recordingStop()
                    }
                    onChatToggle={this.handleChatToggle}
                    onParticipantsToggle={this.handleParticipantsToggle}
                    onAudioClick={() => call.toggleAudio()}
                    onVideoClick={() => call.toggleVideo()}
                    onScreenSharingClick={this.handleScreenSharingToggle}
                    onHoldClick={this.handleHoldToggle}
                    onVideoDoubleClick={this.handleSpeakerChange}
                    setActiveElement={this.setActiveElement}
                />

                {sidebar &&
                    <Sidebar
                        {...STREAM_PROPS}
                        guest={guest}
                        initialCallRinging={initialCallRinging}
                        typingAreaText={typingAreaText}
                        onGuestClose={() => this.setState({ guest: false })}
                        onSidebarClose={() => this.setState({ ...Call.STATE.DEFAULT })}
                        onDeleteMessage={onDeleteMessage}
                        onCallMinimize={this.handleCallMinimize}
                        onInviteToggle={() => this.handleInviteOrAdd()}
                        onTypingAreaChanged={onTypingAreaChanged}
                    />
                }

                {minimized ?
                    null :
                    <>
                        {this.renderRecordingControl()}
                        <StreamControls
                            call={call}
                            minimized={minimized}
                            peers={peers}
                            chatRoom={chatRoom}
                            recorderCid={recorderCid}
                            hovered={hovered}
                            raisedHandPeers={raisedHandPeers}
                            onboardingRaise={onboardingRaise}
                            onOnboardingRaiseDismiss={() => {
                                this.setState({ onboardingRaise: false, hovered: false }, () => {
                                    this.flagMap.setSync(OBV4_FLAGS.CHAT_CALL_RAISE, 1);
                                    this.flagMap.safeCommit();
                                });
                            }}
                            onRecordingToggle={() =>
                                // TODO: method instead a prop
                                this.setState({ recorderCid: undefined }, () => call.sfuClient.recordingStop())
                            }
                            onAudioClick={() => call.toggleAudio()}
                            onVideoClick={() => call.toggleVideo()}
                            onScreenSharingClick={this.handleScreenSharingToggle}
                            onCallEnd={this.handleCallEnd}
                            onStreamToggle={this.handleStreamToggle}
                            onHoldClick={this.handleHoldToggle}
                            setActiveElement={this.setActiveElement}
                        />
                        <SidebarControls
                            call={call}
                            chatRoom={chatRoom}
                            npeers={peers.length}
                            mode={mode}
                            view={view}
                            sidebar={sidebar}
                            onChatToggle={this.handleChatToggle}
                            onParticipantsToggle={this.handleParticipantsToggle}
                            onInviteToggle={() => this.handleInviteOrAdd()}
                        />
                    </>
                }

                {invite &&
                    <Invite
                        contacts={M.u}
                        call={call}
                        chatRoom={chatRoom}
                        onClose={() => this.setState({ invite: false })}
                    />
                }

                {ephemeral &&
                    <Ephemeral
                        ephemeralAccounts={ephemeralAccounts}
                        onClose={() => this.setState({ ephemeral: false })}
                    />
                }

                {offline &&
                    <Offline
                        onClose={() => {
                            if (offline) {
                                this.setState({ offline: false }, () =>
                                    delay('call:timeout', this.handleRetryTimeout, 3e4)
                                );
                            }
                        }}
                        onCallEnd={() => {
                            this.setState({ offline: false }, () =>
                                this.handleRetryTimeout()
                            );
                        }}
                    />
                }

                {onboardingUI &&
                    <div className={`${NAMESPACE}-onboarding`}>
                        <div
                            className="mega-dialog mega-onboarding-dialog dialog-template-message onboarding-UI"
                            id="ob-dialog"
                            role="dialog"
                            aria-labelledby="ob-dialog-title"
                            aria-modal="true">
                            <i className="sprite-fm-mono icon-tooltip-arrow tooltip-arrow top" id="ob-dialog-arrow"/>
                            <header>
                                <div>
                                    <h2 id="ob-dialog-title">{l.onboarding_call_title}</h2>
                                    <p id="ob-dialog-text">{l.onboarding_call_body}</p>
                                </div>
                            </header>
                            <footer>
                                <div className="footer-container">
                                    <button
                                        className="mega-button js-next small theme-light-forced"
                                        onClick={() => {
                                            // TODO: refactor and transition to `ChatOnboarding`,
                                            // see `setOnboarding`
                                            this.setState(
                                                {
                                                    onboardingUI: false,
                                                    onboardingRecording:
                                                        chatRoom.iAmOperator() &&
                                                        !this.flagMap.getSync(OBV4_FLAGS.CHAT_CALL_RECORDING)
                                                },
                                                () => {
                                                    this.flagMap.setSync(OBV4_FLAGS.CHAT_CALL_UI, 1);
                                                    this.flagMap.safeCommit();
                                                    this.setState({
                                                        onboardingRaise:
                                                            !this.state.onboardingRecording &&
                                                            !this.flagMap.getSync(OBV4_FLAGS.CHAT_CALL_RAISE)
                                                    });
                                                }
                                            );
                                        }}>
                                        <span>{l.ok_button}</span>
                                    </button>
                                </div>
                            </footer>
                        </div>
                    </div>
                }

                {onboardingRecording && Call.isModerator(chatRoom, u_handle) &&
                    <div className={`${NAMESPACE}-onboarding`}>
                        <div
                            className="mega-dialog mega-onboarding-dialog dialog-template-message onboarding-recording"
                            id="ob-dialog"
                            role="dialog"
                            aria-labelledby="ob-dialog-title"
                            aria-modal="true">
                            <i
                                className="sprite-fm-mono icon-tooltip-arrow tooltip-arrow bottom" id="ob-dialog-arrow"
                            />
                            <header>
                                <div>
                                    <h2 id="ob-dialog-title">{l.recording_onboarding_title}</h2>
                                    <p id="ob-dialog-text">{l.recording_onboarding_body_intro}</p>
                                    <p id="ob-dialog-text">{l.recording_onboarding_body_details}</p>
                                </div>
                            </header>
                            <footer>
                                <div className="footer-container">
                                    <Link
                                        className="link-button"
                                        to="https://help.mega.io/chats-meetings/chats/call-recording"
                                        target="_blank">
                                        {l[8742] /* `Learn more` */}
                                    </Link>
                                    <button
                                        className="mega-button js-next small theme-light-forced"
                                        onClick={() => {
                                            this.setState({
                                                onboardingRecording: false,
                                                onboardingRaise: true
                                            }, () => {
                                                this.flagMap.setSync(OBV4_FLAGS.CHAT_CALL_RECORDING, 1);
                                                this.flagMap.safeCommit();
                                            });
                                        }}>
                                        <span>{l.ok_button /* `OK, got it` */}</span>
                                    </button>
                                </div>
                            </footer>
                        </div>
                    </div>
                }

                {recordingConsentDialog &&
                    <RecordingConsentDialog
                        peers={peers}
                        recorderCid={recorderCid}
                        onClose={() =>
                            this.setState({
                                recordingConsentDialog: false,
                                recordingConsented: true
                            })
                        }
                        onCallEnd={this.handleCallEnd}
                    />
                }

                {invitePanel &&
                    <ModalDialogsUI.ModalDialog
                        className="theme-dark-forced"
                        onClose={() => {
                            this.setState({ invitePanel: false });
                        }}
                        dialogName="chat-link-dialog"
                        chatRoom={chatRoom}>
                        <InviteParticipantsPanel
                            chatRoom={chatRoom}
                            onAddParticipants={() => {
                                this.setState({ invitePanel: false }, () => this.handleInviteToggle());
                            }}
                        />
                    </ModalDialogsUI.ModalDialog>
                }
            </div>
        );
    }
}
