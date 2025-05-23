import React from 'react';
import { compose } from '../../../mixins.js';
import { PerfectScrollbar } from '../../../../ui/perfectScrollbar.jsx';
import { stringToTime } from './helpers.jsx';
import { withDateObserver } from './dateObserver';

class Select extends React.Component {
    static NAMESPACE = 'meetings-select';

    domRef = React.createRef();
    inputRef = React.createRef();
    menuRef = React.createRef();
    optionRefs = {};

    state = {
        expanded: false,
        manualTimeInput: '',
        timestamp: ''
    };

    getFormattedDuration(duration) {
        duration = moment.duration(duration);
        const days = duration.get('days');
        const hours = duration.get('hours');
        const minutes = duration.get('minutes');

        if (!hours && !minutes && !days) {
            return '';
        }

        const totalHours = days ? ~~duration.asHours() : hours;

        if (!hours && minutes) {
            // return l.time_offset_om;
            return days ?
                `(${totalHours}\u00a0h ${minutes}\u00a0m)` :
                `(${minutes}\u00a0m)`;
        }

        // return (minutes ? l.time_offset_wm : l.time_offset_wh).replace('%d', hours);
        return minutes ?
            `(${totalHours}\u00a0h ${minutes}\u00a0m)` :
            `(${totalHours}\u00a0h)`;
    }

    handleMousedown = ({ target }) =>
        this.domRef?.current.contains(target) ? null : this.setState({ expanded: false });

    handleToggle = ({ target } = {}) => {
        const menuRef = this.menuRef?.current;
        const menuElement = menuRef.domRef?.current;

        if (target !== menuElement) {
            const { value } = this.props;
            this.setState(state => ({ expanded: !state.expanded }), () => {
                if (value && this.optionRefs[value]) {
                    menuRef.scrollToElement(this.optionRefs[value]);
                }
            });
        }
    };

    componentWillUnmount() {
        document.removeEventListener('mousedown', this.handleMousedown);
        if (this.inputRef && this.inputRef.current) {
            $(this.inputRef.current).unbind(`keyup.${Select.NAMESPACE}`);
        }
    }

    componentDidMount() {
        document.addEventListener('mousedown', this.handleMousedown);
        const inputRef = this.inputRef?.current;
        if (inputRef) {
            $(inputRef).rebind(`keyup.${Select.NAMESPACE}`, ({ keyCode }) => {
                if (keyCode === 13 /* RET */) {
                    this.handleToggle();
                    inputRef.blur();
                    return false;
                }
            });
        }
    }

    render() {
        const { NAMESPACE } = Select;
        const {
            name,
            className,
            icon,
            typeable,
            options,
            value,
            format,
            isLoading,
            onChange,
            onBlur,
            onSelect
        } = this.props;

        return (
            <div
                ref={this.domRef}
                className={`
                    ${NAMESPACE}
                    ${className || ''}
                `}>
                <div
                    className={`
                        mega-input
                        dropdown-input
                        ${typeable ? 'typeable' : ''}
                    `}
                    onClick={isLoading ? null : this.handleToggle}>
                    {typeable ? null : value && <span>{format ? format(value) : value}</span>}
                    <input
                        ref={this.inputRef}
                        type="text"
                        className={`
                            ${NAMESPACE}-input
                            ${name}
                        `}
                        value={(() => {
                            if (this.state.manualTimeInput) {
                                return this.state.manualTimeInput;
                            }
                            return format ? format(value) : value;
                        })()}
                        onFocus={({ target }) => {
                            this.setState({ manualTimeInput: '', timestamp: '' }, () => target.select());
                        }}
                        onChange={({ target }) => {
                            const { value: manualTimeInput } = target;
                            const { value } = this.props;
                            const prevDate = moment(value);
                            const inputTime = stringToTime(manualTimeInput);
                            prevDate.set({ hours: inputTime.get('hours'), minutes: inputTime.get('minutes') });
                            const timestamp = prevDate.valueOf();
                            onChange?.(timestamp);
                            if (this.optionRefs[value]) {
                                this.menuRef.current.scrollToElement(this.optionRefs[value]);
                            }
                            this.setState({ manualTimeInput, timestamp });
                        }}
                        onBlur={() => {
                            onBlur(this.state.timestamp);
                            this.setState({ manualTimeInput: '', timestamp: '' });
                        }}
                    />
                    {icon && <i className="sprite-fm-mono icon-dropdown"/>}
                    {options && (
                        <div
                            className={`
                                mega-input-dropdown
                                ${this.state.expanded ? '' : 'hidden'}
                            `}>
                            <PerfectScrollbar
                                ref={this.menuRef}
                                options={{ suppressScrollX: true }}>
                                {options.map(option => {
                                    return (
                                        <div
                                            ref={ref => {
                                                this.optionRefs[option.value] = ref;
                                            }}
                                            key={option.value}
                                            className={`
                                                option
                                                ${option.value === value || option.label === value ? 'active' : ''}
                                            `}
                                            onClick={() => onSelect(option)}>
                                            {option.label}
                                            &nbsp;
                                            {option.duration && this.getFormattedDuration(option.duration)}
                                        </div>
                                    );
                                })}
                            </PerfectScrollbar>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

export default compose(withDateObserver)(Select);
