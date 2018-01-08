export class CCUser {
    constructor(username) {
        this.level = username.charAt(0) | 0;
        [this.nickname, this.address] = username.substring(1).split(',');
    }

    get username() {
        return `${this.level}${this.nickname},${this.address}`;
    }

    get userClass() {
        if (this.level == 0) return 'regular';
        if (this.level == 1) return 'cyantist';
        if (this.level == 2) return 'server';
        if (this.level == 3) return 'error';
        if (this.level == 4) return 'guest';
        return '';
    }

    toHtml() {
        return `<span class="user ${this.userClass}">${this.nickname}</span>`;
    }
}

