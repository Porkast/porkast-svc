import { NotificationParams } from "../models/subscription";
import { EmailService } from "./email.service";


describe('EmailService', () => {
    it('should be defined', () => {
        expect(new EmailService(null)).toBeDefined();
    });

    it('the email template should not be empty', () => {
        const emailService = new EmailService(null);
        const param : NotificationParams = {
            to: 'test to',
            subject: 'test subject',
            keyword: 'porkast keyword',
            nickname: 'porkast nickname',
            updateCount: 1,
            titleList: ['test1', 'test2', 'test3'],
            link: 'https://porkast.com/'
        }
        const htmlTempText = emailService.generateEmailHtmlText(param)
        console.log(htmlTempText)
        expect(htmlTempText).not.toBe('');
    })
})