from datetime import date
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session

BOGOTA = ZoneInfo("America/Bogota")

CITAS_HOY_SQL = """
WITH citas_unicas AS (
    SELECT
        TO_CHAR(c.cithor, 'HH24:MI:SS') AS hora,
        p.pactid,
        c.citcar,
        TRIM(REPLACE(
            COALESCE(p.pacnom, '') || ' ' ||
            COALESCE(p.pacno2, '') || ' ' ||
            COALESCE(p.pacap1, '') || ' ' ||
            COALESCE(p.pacap2, ''),
        '  ', ' ')) AS nombre,
        p.pacsex,
        c.citest,
        c.cithor,
        ROW_NUMBER() OVER (PARTITION BY c.citcar ORDER BY c.cithor ASC) AS rn
    FROM siide s
    INNER JOIN cncit c
        ON TRIM(s.idemed) = TRIM(c.citmed)
        AND TRIM(s.ideesp) = TRIM(c.citesp)
    LEFT JOIN abpac p
        ON c.citcar = p.pacide
    WHERE UPPER(TRIM(s.idecod)) = UPPER(TRIM(:username))
      AND TRUNC(TO_DATE(TRIM(c.citfci), 'DD/MM/RR')) = TO_DATE(:fecha_hoy, 'YYYY-MM-DD')
      AND c.citest IN ('T', 'P')
)
SELECT
    hora,
    pactid,
    citcar,
    nombre,
    pacsex,
    citest
FROM citas_unicas
WHERE rn = 1
ORDER BY cithor ASC
"""


def today_bogota() -> date:
    from datetime import datetime

    return datetime.now(BOGOTA).date()


def _row_str(value: object | None) -> str | None:
    if value is None:
        return None
    return str(value).strip() or None


def fetch_citas_hoy(db: Session, username: str, fecha: date | None = None) -> tuple[date, list[dict]]:
    day = fecha or today_bogota()
    fecha_hoy = day.strftime("%Y-%m-%d")
    rows = db.execute(
        text(CITAS_HOY_SQL),
        {"username": username, "fecha_hoy": fecha_hoy},
    ).mappings()

    data: list[dict] = []
    for row in rows:
        data.append(
            {
                "hora": _row_str(row.get("hora")) or "",
                "pactid": _row_str(row.get("pactid")),
                "citcar": _row_str(row.get("citcar")),
                "nombre": (_row_str(row.get("nombre")) or "").strip(),
                "pacsex": _row_str(row.get("pacsex")),
                "citest": _row_str(row.get("citest")) or "",
            }
        )
    return day, data