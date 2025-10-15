import React from 'react';
import { Emoji } from '../../../../../ui/utils.jsx';
import { ConversationMessageMixin } from '../../mixin.jsx';
import { MetaRichpreviewLoading } from './metaRichPreviewLoading.jsx';
import {ContactVerified, ContactPresence, Avatar} from "../../../contacts.jsx";

class MetaRichpreviewMegaLinks extends ConversationMessageMixin {
    render() {
        var message = this.props.message;
        var chatRoom = this.props.message.chatRoom;
        var previewContainer;

        var output = [];

        var megaLinks = message.megaLinks ? message.megaLinks : [];
        for (var i = 0; i < megaLinks.length; i++) {
            var megaLinkInfo = megaLinks[i];
            if (megaLinkInfo.failed) {
                continue;
            }

            if (megaLinkInfo.hadLoaded() === false) {
                if (megaLinkInfo.startedLoading() === false) {
                    megaLinkInfo.getInfo()
                        .then(() => {
                            const { megaLinks } = this.props.message;
                            const contactLinkHandles = megaLinks
                                .filter(link => link.is_contactlink)
                                .map(link => link.info.h);
                            if (contactLinkHandles.length) {
                                this.addContactListenerIfMissing(contactLinkHandles);
                            }
                        })
                        .catch(reportError)
                        .finally(() => {
                            message.trackDataChange();

                            onIdle(() => {
                                this.safeForceUpdate();
                            });
                        });
                }

                previewContainer = <MetaRichpreviewLoading message={message} isLoading={megaLinkInfo.hadLoaded()} />;
            }
            else if (megaLinkInfo.is_contactlink) {
                var fakeContact = M.u[megaLinkInfo.info.h] ? M.u[megaLinkInfo.info.h] : {
                    'u': megaLinkInfo.info.h,
                    'm': megaLinkInfo.info.e,
                    'firstName': megaLinkInfo.info.fn,
                    'lastName': megaLinkInfo.info.ln,
                    'name': megaLinkInfo.info.fn + " " + megaLinkInfo.info.ln,
                };
                if (!M.u[fakeContact.u]) {
                    M.u.set(fakeContact.u, new MegaDataObject(MEGA_USER_STRUCT, {
                        'u': fakeContact.u,
                        'name': fakeContact.firstName + " " + fakeContact.lastName,
                        'm': fakeContact.m ? fakeContact.m : "",
                        'c': undefined
                    }));
                }
                var contact = M.u[megaLinkInfo.info.h];




                previewContainer = <div key={megaLinkInfo.info.h} className={"message shared-block contact-link"}>
                    <div className="message shared-info">
                        <div className="message data-title selectable-txt">{contact.name}</div>
                        <ContactVerified className="right-align" contact={contact} />
                        <div className="user-card-email selectable-txt">{contact.m}</div>
                    </div>
                    <div className="message shared-data">
                        <div className="data-block-view semi-big">
                            <ContactPresence className="small" contact={contact} />
                            <Avatar className="avatar-wrapper medium-avatar" contact={contact}
                                chatRoom={chatRoom} />
                        </div>
                        <div className="clear"></div>
                    </div>
                </div>;
            }
            else {
                var desc;

                var is_icon = megaLinkInfo.is_dir ?
                    true : !(megaLinkInfo.havePreview() && megaLinkInfo.info.preview_url);

                if (megaLinkInfo.is_chatlink) {
                    desc = l[8876].replace('%1', megaLinkInfo.info.ncm) /* `Chat participants: %1` */;
                }
                else if (!megaLinkInfo.is_dir) {
                    desc = bytesToSize(megaLinkInfo.info.size);
                }
                else {
                    const totalNumberOfFiles = megaLinkInfo.info.s[1];
                    const numOfVersionedFiles = megaLinkInfo.info.s[4];
                    const folderCount = megaLinkInfo.info.s[2];
                    const totalFileSize = megaLinkInfo.info.size;
                    const versionsSize = megaLinkInfo.info.s[3];
                    desc = <span>
                        {fm_contains(totalNumberOfFiles - numOfVersionedFiles, folderCount - 1)}<br/>
                        {bytesToSize(totalFileSize - versionsSize)}
                    </span>;
                }

                previewContainer = <div className={"message richpreview body " + (
                    (is_icon ? "have-icon" : "no-icon") + " " +
                    (megaLinkInfo.is_chatlink ? "is-chat" : "")
                )}>
                    {megaLinkInfo.havePreview() && megaLinkInfo.info.preview_url ?
                        <div className="message richpreview img-wrapper">
                            <div className="message richpreview preview"
                                style={{"backgroundImage": 'url(' + megaLinkInfo.info.preview_url + ')'}}></div>
                        </div> :
                        <div className="message richpreview img-wrapper">
                            {megaLinkInfo.is_chatlink ?
                                <i className="huge-icon conversations"></i>
                                :
                                <div className={"message richpreview icon item-type-icon-90 icon-" + (
                                    megaLinkInfo.is_dir ?
                                        "folder" :
                                        fileIcon(megaLinkInfo.info)
                                ) + "-90"}></div>
                            }
                        </div>
                    }
                    <div className="message richpreview inner-wrapper">
                        <div className="message richpreview data-title selectable-txt">
                            <span className="message richpreview title">
                                <Emoji>
                                    {megaLinkInfo.info.name || megaLinkInfo.info.topic || ""}
                                </Emoji>
                            </span>
                        </div>
                        <div className="message richpreview desc">{desc}</div>
                        <div className="message richpreview url-container">
                            <span className="message richpreview url-favicon">
                                <img src={`https://mega.${mega.tld}/favicon.ico?v=3&c=1`} width={16} height={16}
                                    onError={(e) => {
                                        if (e && e.target && e.target.parentNode) {
                                            e.target.parentNode.removeChild(e.target);
                                        }
                                    }}
                                    alt=""
                                />
                            </span>
                            <span className="message richpreview url">
                                {ellipsis(megaLinkInfo.getLink(), 'end', 40)}
                            </span>
                        </div>
                    </div>
                </div>;
            }

            output.push(
                <div key={megaLinkInfo.node_key + "_" + output.length} className={"message richpreview container " +
                        (megaLinkInfo.havePreview() ? "have-preview" : "no-preview") + " " +
                        (megaLinkInfo.d ? "have-description" : "no-description") + " " +
                        (!megaLinkInfo.hadLoaded() ? "is-loading" : "done-loading")
                }
                onClick={function(url, megaLinkInfo) {
                    if (megaLinkInfo.hadLoaded()) {
                        if (window.sfuClient && megaLinkInfo.is_chatlink) {
                            const { chatRoom: callRoom } = megaChat.activeCall;
                            const peers = callRoom ?
                                callRoom
                                    .getParticipantsExceptMe(callRoom.getCallParticipants())
                                    .map(h => M.getNameByHandle(h))
                                : [];
                            const body = peers.length
                                ? mega.utils.trans.listToString(peers, l.cancel_with_to_join)
                                : l.cancel_to_join;
                            return msgDialog(
                                'confirmation',
                                undefined,
                                l.call_in_progress,
                                body,
                                e => e && window.open(url, '_blank', 'noopener,noreferrer')
                            );
                        }
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                }.bind(this, megaLinkInfo.getLink(), megaLinkInfo)}>
                    {previewContainer}
                    <div className="clear"></div>
                </div>
            );
        }
        return <div className="message richpreview previews-container">{output}</div>;
    }
}

export {
    MetaRichpreviewMegaLinks
};
