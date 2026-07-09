import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PersonnelRequisition } from '../personnel-requisitions/entities/personnel-requisition.entity';
import { NonconformanceReport } from '../nonconformance-reports/entities/nonconformance-report.entity';
import { NODE_ENV_DEVELOPMENT } from '@/constants';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private MAIL_USER_APP: string = '';
  private FRONTEND_URL: string = '';
  private CURRENT_ENV: string = '';

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.MAIL_USER_APP = this.configService.getOrThrow<string>('app.mail.user');
    this.FRONTEND_URL =
      this.configService.getOrThrow<string>('app.frontendUrl');
    this.CURRENT_ENV = this.configService.getOrThrow<string>('app.nodeEnv');
  }

  private formatDate(value?: Date): string {
    if (!value) {
      return 'No disponible';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(value);
  }

  get emailTest(): string[] {
    let emails: string[] = [];
    if (this.CURRENT_ENV === NODE_ENV_DEVELOPMENT) {
      emails = ['eduardo-266@hotmail.com'];
    }
    return emails;
  }

  private get nonconformanceAlertEmails(): string[] {
    if (this.CURRENT_ENV === NODE_ENV_DEVELOPMENT) {
      return ['eduardo-266@hotmail.com'];
    }

    //return ['strujillo@hadamexico.com', 'sst@hadamexico.com'];
    return ['sst@hadamexico.com'];
  }

  private resolveEvidenceAbsolutePath(imageUrl: string): string {
    const relativePath = imageUrl.replace(/^\/+/, '');
    return resolve(process.cwd(), 'public', relativePath);
  }

  async personnelRequisitionCreate(
    emailsToNotify: string[],
    personnelRequisition: PersonnelRequisition,
  ): Promise<void> {
    const emailTest = this.emailTest;
    if (emailTest.length) {
      emailsToNotify = emailTest;
    }

    this.logger.debug(
      `Sending create email to ${emailsToNotify.join(', ')} for personnel requisition ID: ${personnelRequisition.id}`,
    );

    try {
      const baseFrontendUrl = this.FRONTEND_URL.replace(/\/+$/, '');
      const requisitionsUrl =
        `${baseFrontendUrl}/requisicion-de-personal` +
        `?viewId=${personnelRequisition.id}`;
      const usersRemplacedNames =
        personnelRequisition.usersRemplaced &&
        personnelRequisition.usersRemplaced.length > 1
          ? personnelRequisition.usersRemplaced
              .map((employee) => employee.name)
              .join(', ')
          : undefined;
      const projectReplacedName = personnelRequisition.projectReplaced?.name;

      const mailOptions: ISendMailOptions = {
        to: emailsToNotify,
        from: `"Desarrollo hada" <${this.MAIL_USER_APP}>`,
        subject: `Nueva solicitud de personal creada (ID: ${personnelRequisition.id})`,
        template: 'personnel-requisition-create',
        context: {
          id: personnelRequisition.id,
          requestDate: this.formatDate(personnelRequisition.requestDate),
          createdAt: this.formatDate(personnelRequisition.createdAt),
          areaName: personnelRequisition.area?.name ?? 'No especificada',
          requestingUserName:
            personnelRequisition.requestingUser?.name ?? 'No especificado',
          requestingPositionName:
            personnelRequisition.positionRequestingUser?.name ??
            'No especificado',
          workplaceName:
            personnelRequisition.workplace?.name ?? 'No especificado',
          positionRequiredName:
            personnelRequisition.positionRequired?.name ?? 'No especificado',
          reasonForRequestName:
            personnelRequisition.reasonForRequest?.name ?? 'No especificado',
          numberOfVacancies: personnelRequisition.numberOfVacancies,
          callType: personnelRequisition.isExternal ? 'Externa' : 'Interna',
          observations:
            personnelRequisition.observations?.trim() || 'Sin observaciones',
          usersRemplacedNames,
          projectReplacedName,
          requisitionsUrl,
        },
      };

      const mailer = this.mailerService as {
        sendMail: (options: ISendMailOptions) => Promise<unknown>;
      };

      await mailer.sendMail(mailOptions);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send create email for personnel requisition ID: ${personnelRequisition.id}. Error: ${errorMessage}`,
      );
    }
  }

  async personnelRequisitionAuthorized(
    emailsToNotify: string[],
    personnelRequisition: PersonnelRequisition,
  ): Promise<void> {
    const emailTest = this.emailTest;
    if (emailTest.length) {
      emailsToNotify = emailTest;
    }

    this.logger.debug(
      `Sending authorized email to ${emailsToNotify.join(', ')} for personnel requisition ID: ${personnelRequisition.id}`,
    );

    try {
      const baseFrontendUrl = this.FRONTEND_URL.replace(/\/+$/, '');
      const requisitionsUrl =
        `${baseFrontendUrl}/requisicion-de-personal` +
        `?viewId=${personnelRequisition.id}`;
      const usersRemplacedNames =
        personnelRequisition.usersRemplaced &&
        personnelRequisition.usersRemplaced.length > 1
          ? personnelRequisition.usersRemplaced
              .map((employee) => employee.name)
              .join(', ')
          : undefined;
      const projectReplacedName = personnelRequisition.projectReplaced?.name;

      const mailOptions: ISendMailOptions = {
        to: emailsToNotify,
        from: `"Desarrollo hada" <${this.MAIL_USER_APP}>`,
        subject: `Solicitud de personal autorizada (ID: ${personnelRequisition.id})`,
        template: 'personnel-requisition-authorized',
        context: {
          id: personnelRequisition.id,
          requestDate: this.formatDate(personnelRequisition.requestDate),
          createdAt: this.formatDate(personnelRequisition.createdAt),
          authorizedB:
            personnelRequisition.authorizedBy?.name ?? 'No especificado',
          authorizedDate: this.formatDate(personnelRequisition.authorizedDate),
          areaName: personnelRequisition.area?.name ?? 'No especificada',
          requestingUserName:
            personnelRequisition.requestingUser?.name ?? 'No especificado',
          requestingPositionName:
            personnelRequisition.positionRequestingUser?.name ??
            'No especificado',
          workplaceName:
            personnelRequisition.workplace?.name ?? 'No especificado',
          positionRequiredName:
            personnelRequisition.positionRequired?.name ?? 'No especificado',
          reasonForRequestName:
            personnelRequisition.reasonForRequest?.name ?? 'No especificado',
          numberOfVacancies: personnelRequisition.numberOfVacancies,
          callType: personnelRequisition.isExternal ? 'Externa' : 'Interna',
          observations:
            personnelRequisition.observations?.trim() || 'Sin observaciones',
          usersRemplacedNames,
          projectReplacedName,
          requisitionsUrl,
        },
      };

      const mailer = this.mailerService as {
        sendMail: (options: ISendMailOptions) => Promise<unknown>;
      };

      await mailer.sendMail(mailOptions);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send authorized email for personnel requisition ID: ${personnelRequisition.id}. Error: ${errorMessage}`,
      );
    }
  }

  async nonconformanceReportThresholdReached(
    report: NonconformanceReport,
    totalReports: number,
    employeeName: string,
    reportedByName: string,
  ): Promise<void> {
    const emailsToNotify = this.nonconformanceAlertEmails;

    this.logger.debug(
      `Sending nonconformance threshold email to ${emailsToNotify.join(', ')} for report ID: ${report.id}`,
    );

    try {
      const baseFrontendUrl = this.FRONTEND_URL.replace(/\/+$/, '');
      const reportsUrl =
        `${baseFrontendUrl}/reporte-incumplimientos` +
        `?search=${encodeURIComponent(employeeName)}`;
      let evidenceImageHtml = '';
      let evidenceLinkHtml = '';
      let attachments: ISendMailOptions['attachments'] = [];

      if (report.imageUrl) {
        if (report.imageUrl.startsWith('http')) {
          evidenceLinkHtml = `
            <a href="${report.imageUrl}" target="_blank" rel="noreferrer" style="display:inline-block; margin-top:10px; color:#00542D; font-size:13px; font-weight:600; text-decoration:underline;">
              Abrir evidencia fotográfica
            </a>
          `;
        } else {
          const evidenceAbsolutePath = this.resolveEvidenceAbsolutePath(
            report.imageUrl,
          );

          if (existsSync(evidenceAbsolutePath)) {
            const evidenceContent = await readFile(evidenceAbsolutePath);
            const evidenceCid = `nonconformance-evidence-${report.id}@desarrollo-hada`;

            attachments = [
              {
                filename: `evidencia-${report.id}.jpg`,
                content: evidenceContent,
                cid: evidenceCid,
              },
            ];

            evidenceImageHtml = `
              <img src="cid:${evidenceCid}" alt="Evidencia del incumplimiento" style="display:block; width:100%; max-width:420px; border-radius:10px; border:1px solid #dce7d2;" />
            `;
          }
        }
      }

      const mailOptions: ISendMailOptions = {
        to: emailsToNotify,
        from: `"Desarrollo hada" <${this.MAIL_USER_APP}>`,
        subject: `Alerta de incumplimientos acumulados - ${employeeName}`,
        html: `
          <div style="margin:0; padding:24px; background:#f4f7f2; font-family:Segoe UI, Tahoma, Arial, sans-serif; color:#113321;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:700px; margin:0 auto; background:#ffffff; border:1px solid #dce7d2; border-radius:14px; overflow:hidden;">
              <tr>
                <td style="padding:18px 22px; background:#00542D; color:#ffffff;">
                  <div style="font-size:12px; letter-spacing:0.6px; text-transform:uppercase; opacity:0.9;">Desarrollo Hada</div>
                  <div style="font-size:22px; line-height:1.3; font-weight:700; margin-top:6px;">Alerta de incumplimientos acumulados</div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 22px; background:#76B629; color:#0f2f1e; font-size:14px; font-weight:600;">
                  Se alcanzó el umbral de reportes acumulados para un colaborador.
                </td>
              </tr>
              <tr>
                <td style="padding:24px 22px 8px 22px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate; border-spacing:0 10px;">
                    <tr>
                      <td style="width:190px; font-size:13px; color:#4b6858;">Total acumulado</td>
                      <td style="font-size:14px; font-weight:700; color:#113321;">${totalReports}</td>
                    </tr>
                    <tr>
                      <td style="width:190px; font-size:13px; color:#4b6858;">Reporte</td>
                      <td style="font-size:14px; font-weight:600; color:#113321;">#${report.id}</td>
                    </tr>
                    <tr>
                      <td style="width:190px; font-size:13px; color:#4b6858;">Colaborador</td>
                      <td style="font-size:14px; font-weight:600; color:#113321;">${employeeName}</td>
                    </tr>
                    <tr>
                      <td style="width:190px; font-size:13px; color:#4b6858;">Desviación</td>
                      <td style="font-size:14px; color:#113321;">${report.deviation}</td>
                    </tr>
                    <tr>
                      <td style="width:190px; font-size:13px; color:#4b6858;">No conformidad</td>
                      <td style="font-size:14px; color:#113321;">${report.nonconformance}</td>
                    </tr>
                    <tr>
                      <td style="width:190px; font-size:13px; color:#4b6858;">Reportado por</td>
                      <td style="font-size:14px; font-weight:600; color:#113321;">${reportedByName}</td>
                    </tr>
                    <tr>
                      <td style="width:190px; font-size:13px; color:#4b6858;">Fecha</td>
                      <td style="font-size:14px; color:#113321;">${this.formatDate(report.createdAt)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 22px 26px 22px;">
                  <a href="${reportsUrl}" target="_blank" rel="noreferrer" style="display:inline-block; background:#00542D; color:#ffffff; text-decoration:none; font-weight:700; font-size:14px; padding:10px 16px; border-radius:10px;">Ver reportes en el sistema</a>
                </td>
              </tr>
              ${
                evidenceImageHtml || evidenceLinkHtml
                  ? `<tr>
                <td style="padding:0 22px 26px 22px;">
                  <div style="font-size:13px; color:#4b6858; margin-bottom:10px;">Evidencia fotográfica</div>
                  ${evidenceImageHtml || evidenceLinkHtml}
                </td>
              </tr>`
                  : ''
              }
            </table>
          </div>
        `,
        attachments,
      };

      const mailer = this.mailerService as {
        sendMail: (options: ISendMailOptions) => Promise<unknown>;
      };

      await mailer.sendMail(mailOptions);
      this.logger.debug(
        `Nonconformance threshold email sent successfully for report ID: ${report.id}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send nonconformance threshold email for report ID: ${report.id}. Error: ${errorMessage}`,
      );
    }
  }
}
