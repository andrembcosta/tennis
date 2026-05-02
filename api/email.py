import resend
from api.config import settings


def _enabled() -> bool:
    return bool(settings.resend_api_key)


async def send_booking_confirmed(
    booker_email: str, booker_name: str,
    partner_email: str, partner_name: str,
    court_name: str, slot_start: str, slot_end: str,
):
    if not _enabled():
        return
    resend.api_key = settings.resend_api_key
    for email, name, other_name in [
        (booker_email, booker_name, partner_name),
        (partner_email, partner_name, booker_name),
    ]:
        try:
            resend.Emails.send({
                "from": settings.from_email,
                "to": email,
                "subject": f"Reserva confirmada - {slot_start}",
                "html": f"""
                    <p>Ola {name},</p>
                    <p>Sua reserva foi confirmada!</p>
                    <ul>
                        <li><strong>Quadra:</strong> {court_name}</li>
                        <li><strong>Horario:</strong> {slot_start} - {slot_end}</li>
                        <li><strong>Parceiro:</strong> {other_name}</li>
                    </ul>
                    <p>Ate logo!</p>
                """,
            })
        except Exception:
            pass


async def send_password_reset(email: str, name: str, token: str):
    if not _enabled():
        return
    resend.api_key = settings.resend_api_key
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    try:
        resend.Emails.send({
            "from": settings.from_email,
            "to": email,
            "subject": "Redefinir senha",
            "html": f"""
                <p>Ola {name},</p>
                <p>Clique no link abaixo para redefinir sua senha. O link expira em 2 horas.</p>
                <p><a href="{reset_url}">Redefinir senha</a></p>
                <p>Se voce nao solicitou isso, ignore este email.</p>
            """,
        })
    except Exception:
        pass
