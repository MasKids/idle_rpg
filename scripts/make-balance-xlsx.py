"""balance/balance.xlsx를 생성하는 스크립트.

상용 게임 데이터 테이블 형식(#TableDefine / #EnumDefine / 카테고리별 데이터 테이블 /
StringTable)으로 밸런싱 데이터를 재구성한다.

이번 단계는 "엑셀 파일 생성까지만" — balance.xlsx를 읽어 JSON으로 바꾸는 변환
스크립트와 게임 코드 리팩터링은 다음 단계에서 진행한다.

실행:
    python scripts/make-balance-xlsx.py
"""

import math
import os

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "balance", "balance.xlsx")

FONT_NAME = "Arial"

# ---------------------------------------------------------------------------
# 공통 서식
# ---------------------------------------------------------------------------

REF_FILL = PatternFill("solid", fgColor="FFF2CC")
REF_FONT = Font(name=FONT_NAME, size=9, color="7F6000")

KOR_FILL = PatternFill("solid", fgColor="2F5597")
KOR_FONT = Font(name=FONT_NAME, size=9, bold=True, color="FFFFFF")

TYPE_FILL = PatternFill("solid", fgColor="D9E2F3")
TYPE_FONT = Font(name=FONT_NAME, size=9, color="1F3864")

ENG_FILL = PatternFill("solid", fgColor="8EA9DB")
ENG_FONT = Font(name=FONT_NAME, size=9, bold=True, color="1F3864")

DATA_FONT = Font(name=FONT_NAME, size=9)

# 메타 시트(#TableDefine, #EnumDefine)용 단일 헤더 서식 — 4행 헤더 대신 한글 칼럼명과 같은 톤 사용
META_HEADER_FILL = KOR_FILL
META_HEADER_FONT = KOR_FONT

CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center")

THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def _display_width(value) -> float:
    """한글 등 non-ascii 문자를 더 넓게 잡아 칼럼 너비를 어림 계산한다."""
    text = "" if value is None else str(value)
    width = 0.0
    for ch in text:
        width += 1.9 if ord(ch) > 0x2000 else 1.0
    return width


def _autosize_columns(ws, num_cols: int, header_rows: list[list]) -> None:
    max_widths = [0.0] * num_cols
    for row in header_rows:
        for i, value in enumerate(row):
            if i < num_cols:
                max_widths[i] = max(max_widths[i], _display_width(value))
    for row in ws.iter_rows():
        for cell in row:
            if cell.column <= num_cols:
                max_widths[cell.column - 1] = max(max_widths[cell.column - 1], _display_width(cell.value))
    for i in range(num_cols):
        letter = get_column_letter(i + 1)
        ws.column_dimensions[letter].width = min(60.0, max(8.0, max_widths[i] + 3.0))


# ---------------------------------------------------------------------------
# 데이터 시트(4행 헤더) 작성
# ---------------------------------------------------------------------------


def write_data_sheet(wb: Workbook, sheet_name: str, columns: list[dict], rows: list[list]) -> None:
    """columns: [{eng, kor, type, ref, desc}, ...] / rows: [[value, ...], ...]"""
    ws = wb.create_sheet(sheet_name)
    num_cols = len(columns)

    ref_row = [c["ref"] for c in columns]
    kor_row = [c["kor"] for c in columns]
    type_row = [c["type"] for c in columns]
    eng_row = [c["eng"] for c in columns]

    header_rows = [ref_row, kor_row, type_row, eng_row]
    header_styles = [
        (REF_FILL, REF_FONT),
        (KOR_FILL, KOR_FONT),
        (TYPE_FILL, TYPE_FONT),
        (ENG_FILL, ENG_FONT),
    ]

    for r, (values, (fill, font)) in enumerate(zip(header_rows, header_styles), start=1):
        for c in range(num_cols):
            cell = ws.cell(row=r, column=c + 1, value=values[c] if values[c] != "" else None)
            cell.fill = fill
            cell.font = font
            cell.alignment = CENTER
            cell.border = BORDER

    for i, row_values in enumerate(rows):
        excel_row = 5 + i
        for c, value in enumerate(row_values):
            cell = ws.cell(row=excel_row, column=c + 1, value=value)
            cell.font = DATA_FONT
            cell.border = BORDER
            cell.alignment = CENTER if isinstance(value, (int, float, bool)) else LEFT

    ws.freeze_panes = "A5"
    last_col_letter = get_column_letter(num_cols)
    last_row = 4 + len(rows)
    ws.auto_filter.ref = f"A4:{last_col_letter}{last_row}"

    _autosize_columns(ws, num_cols, header_rows)


# ---------------------------------------------------------------------------
# 메타 시트(#TableDefine, #EnumDefine, 단일 헤더) 작성
# ---------------------------------------------------------------------------


def write_meta_sheet(wb: Workbook, sheet_name: str, headers: list[str], rows: list[list]) -> None:
    ws = wb.create_sheet(sheet_name)
    num_cols = len(headers)

    for c, header in enumerate(headers):
        cell = ws.cell(row=1, column=c + 1, value=header)
        cell.fill = META_HEADER_FILL
        cell.font = META_HEADER_FONT
        cell.alignment = CENTER
        cell.border = BORDER

    for i, row_values in enumerate(rows):
        excel_row = 2 + i
        for c, value in enumerate(row_values):
            cell = ws.cell(row=excel_row, column=c + 1, value=value)
            cell.font = DATA_FONT
            cell.border = BORDER
            cell.alignment = CENTER if isinstance(value, (int, float, bool)) else LEFT

    ws.freeze_panes = "A2"
    last_col_letter = get_column_letter(num_cols)
    last_row = 1 + len(rows)
    ws.auto_filter.ref = f"A1:{last_col_letter}{last_row}"

    _autosize_columns(ws, num_cols, [headers])


# ---------------------------------------------------------------------------
# 기존 코드의 공식을 그대로 재사용해 초기값을 정확히 뽑아낸다 (손계산 금지)
# ---------------------------------------------------------------------------


def enemy_hp(stage: int) -> int:
    return math.floor(20 * 1.15 ** (stage - 1))


def enemy_atk(stage: int) -> int:
    return math.floor(3 * 1.12 ** (stage - 1))


def gold_reward(stage: int) -> int:
    return math.floor(5 * 1.1 ** (stage - 1))


def growth_reward(stage: int) -> int:
    return math.floor(2 * 1.08 ** (stage - 1))


def exist_reward(stage: int) -> int:
    return max(1, math.floor(stage / 10))


def node_cost(order: int) -> int:
    return math.floor(10 * 1.35 ** (order - 1))


def stat_value(order: int) -> int:
    return 5 + math.floor(order / 5) * 3


def currency_amount(order: int) -> int:
    return 5 + math.floor(order / 5) * 5


BOSS_HP_MULT = 5
BOSS_ATK_MULT = 2
BOSS_REWARD_MULT = 3
BOSS_EXIST_MULT = 2
BOSS_TIME_ENERGY_REWARD = 5

HP_GROWTH_RATE = 1.15  # EnemyHp/EnemyAtk 공통 적용
REWARD_GROWTH_RATE = 1.1  # 골드/성장에너지/존재력 보상 공통 적용


# ===========================================================================
# 1. #TableDefine 용 스키마 레지스트리 — 아래에서 만드는 모든 테이블이 여기 등록되고,
#    #TableDefine 시트는 이 레지스트리를 그대로 펼쳐서 만든다 (중복 기재 방지)
# ===========================================================================

TABLE_REGISTRY: list[tuple[str, list[dict]]] = []


def register(table_name: str, columns: list[dict]) -> list[dict]:
    TABLE_REGISTRY.append((table_name, columns))
    return columns


# ---------------------------------------------------------------------------
# StageTable
# ---------------------------------------------------------------------------

STAGE_TABLE_COLUMNS = register(
    "StageTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용). 정렬 바뀌어도 무방"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "스테이지 구간 고유 ID (10000번대)"},
        {"eng": "//Name", "kor": "이름", "type": "string", "ref": "", "desc": "행 구분용 참고 이름 (파싱 제외)"},
        {"eng": "Chapter", "kor": "챕터", "type": "int", "ref": "", "desc": "몇 번째 챕터(구간)인지. 챕터당 10스테이지"},
        {
            "eng": "StageType",
            "kor": "스테이지 유형",
            "type": "enum",
            "ref": "EnumDefine/StageType",
            "desc": "일반 스테이지인지 보스 스테이지(챕터의 10번째)인지",
        },
        {
            "eng": "EnemyHp",
            "kor": "적 HP",
            "type": "float",
            "ref": "",
            "desc": "이 행이 나타내는 스테이지(챕터 첫 스테이지, 또는 보스 스테이지) 기준 적 HP",
        },
        {
            "eng": "EnemyAtk",
            "kor": "적 공격력",
            "type": "float",
            "ref": "",
            "desc": "이 행이 나타내는 스테이지 기준 적 공격력",
        },
        {
            "eng": "KillCount",
            "kor": "처치 필요 수",
            "type": "int",
            "ref": "",
            "desc": "다음 스테이지로 넘어가기 위한 처치 수 (보스는 1)",
        },
        {"eng": "RewardGold", "kor": "골드 보상", "type": "int", "ref": "", "desc": "처치 1회당 골드 보상 (기준 스테이지)"},
        {
            "eng": "RewardGrowth",
            "kor": "성장에너지 보상",
            "type": "int",
            "ref": "",
            "desc": "처치 1회당 성장에너지 보상 (기준 스테이지)",
        },
        {
            "eng": "RewardExist",
            "kor": "존재력 보상",
            "type": "int",
            "ref": "",
            "desc": "처치 1회당 존재력 보상 (기준 스테이지)",
        },
        {
            "eng": "RewardTimeEnergy",
            "kor": "시간에너지 보상",
            "type": "int",
            "ref": "",
            "desc": "처치 1회당 시간에너지 보상 (일반 스테이지는 0, 보스만 지급)",
        },
        {
            "eng": "HpGrowthRate",
            "kor": "HP 증가율",
            "type": "float",
            "ref": "",
            "desc": "챕터 내 스테이지 1개 진행마다 EnemyHp·EnemyAtk에 공통 적용되는 증가 배율 (보간용)",
        },
        {
            "eng": "RewardGrowthRate",
            "kor": "보상 증가율",
            "type": "float",
            "ref": "",
            "desc": "챕터 내 스테이지 1개 진행마다 골드·성장에너지·존재력 보상에 공통 적용되는 증가 배율 (보간용)",
        },
    ],
)


def build_stage_rows() -> list[list]:
    rows = []
    idx = 1
    for chapter in range(1, 11):
        normal_stage = (chapter - 1) * 10 + 1
        boss_stage = chapter * 10

        rows.append(
            [
                idx,
                10000 + idx,
                f"챕터{chapter} 일반",
                chapter,
                "Normal",
                enemy_hp(normal_stage),
                enemy_atk(normal_stage),
                5,
                gold_reward(normal_stage),
                growth_reward(normal_stage),
                exist_reward(normal_stage),
                0,
                HP_GROWTH_RATE,
                REWARD_GROWTH_RATE,
            ]
        )
        idx += 1

        rows.append(
            [
                idx,
                10000 + idx,
                f"챕터{chapter} 보스",
                chapter,
                "Boss",
                enemy_hp(boss_stage) * BOSS_HP_MULT,
                enemy_atk(boss_stage) * BOSS_ATK_MULT,
                1,
                gold_reward(boss_stage) * BOSS_REWARD_MULT,
                growth_reward(boss_stage) * BOSS_REWARD_MULT,
                exist_reward(boss_stage) * BOSS_EXIST_MULT,
                BOSS_TIME_ENERGY_REWARD,
                HP_GROWTH_RATE,
                REWARD_GROWTH_RATE,
            ]
        )
        idx += 1
    return rows


# ---------------------------------------------------------------------------
# StatTable
# ---------------------------------------------------------------------------

STAT_TABLE_COLUMNS = register(
    "StatTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용)"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "스탯 고유 ID (20000번대)"},
        {"eng": "//Name", "kor": "이름", "type": "string", "ref": "", "desc": "행 구분용 참고 이름 (파싱 제외)"},
        {"eng": "StatType", "kor": "스탯 종류", "type": "enum", "ref": "EnumDefine/StatType", "desc": "6스탯 중 어떤 스탯인지"},
        {
            "eng": "Name",
            "kor": "이름ID",
            "type": "int",
            "ref": "StringTable/Id",
            "desc": "화면에 표시할 스탯 이름의 StringTable ID",
        },
        {"eng": "BaseValue", "kor": "기본값", "type": "float", "ref": "", "desc": "레벨 0일 때 스탯 값"},
        {"eng": "ValuePerLevel", "kor": "레벨당 상승치", "type": "float", "ref": "", "desc": "업그레이드 1레벨당 상승하는 값"},
        {
            "eng": "CostBase",
            "kor": "기준 비용",
            "type": "int",
            "ref": "",
            "desc": "레벨 0→1 업그레이드 비용(성장에너지)",
        },
        {
            "eng": "CostGrowthRate",
            "kor": "비용 증가율",
            "type": "float",
            "ref": "",
            "desc": "비용 = CostBase × CostGrowthRate^현재레벨",
        },
        {
            "eng": "MaxLevel",
            "kor": "최대 레벨",
            "type": "int",
            "ref": "",
            "desc": "레벨 상한. 현재는 실질적 상한 없음을 뜻하는 자리 표시자(9999) — 다음 단계에서 필요 시 조정",
        },
        {"eng": "//Description", "kor": "설명", "type": "string", "ref": "", "desc": "행에 대한 참고 설명 (파싱 제외)"},
    ],
)

def build_stat_rows() -> list[list]:
    # (StatType, 한글명, StringTableId, BaseValue, ValuePerLevel)
    specs = [
        ("ATK", "공격력", 40001, 1, 1),
        ("DEF", "방어력", 40002, 1, 1),
        ("ASPD", "공격속도", 40003, 1, 0.05),
        ("CRIT", "치명타확률", 40004, 0, 0.5),
        ("CRIT_DMG", "치명타피해", 40005, 150, 2),
        ("EXIST_GAIN", "존재력획득량", 40006, 1, 0.02),
    ]
    rows = []
    for i, (stat_type, kor_name, string_id, base, per_level) in enumerate(specs, start=1):
        rows.append(
            [
                i,
                20000 + i,
                kor_name,
                stat_type,
                string_id,
                base,
                per_level,
                8,
                1.18,
                9999,
                f"{kor_name}({stat_type}) 성장 스탯. 원본 공식과 동일한 기준값/증가치",
            ]
        )
    return rows


# ---------------------------------------------------------------------------
# ExistTreeTable
# ---------------------------------------------------------------------------

EXIST_TREE_TABLE_COLUMNS = register(
    "ExistTreeTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용)"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "존재력 트리 티어 고유 ID (30000번대)"},
        {"eng": "//Name", "kor": "이름", "type": "string", "ref": "", "desc": "행 구분용 참고 이름 (파싱 제외)"},
        {"eng": "Tier", "kor": "티어", "type": "int", "ref": "", "desc": "존재력 트리 5티어 중 몇 번째인지 (1~5)"},
        {"eng": "OrderFrom", "kor": "시작 순번", "type": "int", "ref": "", "desc": "이 티어에 속하는 노드의 시작 order (포함)"},
        {"eng": "OrderTo", "kor": "끝 순번", "type": "int", "ref": "", "desc": "이 티어에 속하는 노드의 끝 order (포함)"},
        {
            "eng": "EffectType",
            "kor": "효과 종류",
            "type": "enum",
            "ref": "EnumDefine/NodeEffectType",
            "desc": "이 티어 노드가 스탯을 올리는지(STAT) 재화를 지급하는지(GRANT)",
        },
        {
            "eng": "StatType",
            "kor": "스탯 종류",
            "type": "enum",
            "ref": "EnumDefine/StatType",
            "desc": "EffectType=STAT일 때 어떤 스탯을 올리는지. GRANT면 공란",
        },
        {
            "eng": "GrantCurrency",
            "kor": "지급 재화",
            "type": "enum",
            "ref": "EnumDefine/CurrencyType",
            "desc": "EffectType=GRANT일 때 어떤 재화를 지급하는지. STAT면 공란",
        },
        {
            "eng": "ValueBase",
            "kor": "효과값 기준",
            "type": "float",
            "ref": "",
            "desc": "이 티어 첫 노드(OrderFrom)의 스탯 상승치/재화 지급량",
        },
        {
            "eng": "ValuePerNode",
            "kor": "노드당 증가치",
            "type": "float",
            "ref": "",
            "desc": "OrderFrom 이후 노드 1개당 ValueBase에 더해지는 값 (보간용)",
        },
        {
            "eng": "CostBase",
            "kor": "기준 비용",
            "type": "int",
            "ref": "",
            "desc": "이 티어 첫 노드(OrderFrom)의 해금 비용(존재력)",
        },
        {
            "eng": "CostGrowthRate",
            "kor": "비용 증가율",
            "type": "float",
            "ref": "",
            "desc": "노드 1개당 비용 = CostBase × CostGrowthRate^(order-OrderFrom)",
        },
        {"eng": "//Description", "kor": "설명", "type": "string", "ref": "", "desc": "행에 대한 참고 설명 (파싱 제외)"},
    ],
)


def build_exist_tree_rows() -> list[list]:
    # (tier, orderFrom, orderTo, effectType, statType, grantCurrency, 한글명)
    specs = [
        (1, 1, 10, "STAT", "ATK", "", "1티어: 공격력"),
        (2, 11, 20, "STAT", "DEF", "", "2티어: 방어력"),
        (3, 21, 30, "STAT", "ASPD", "", "3티어: 공격속도"),
        (4, 31, 40, "GRANT", "", "MASTERY_ESSENCE", "4티어: 숙련의 정수 지급"),
        (5, 41, 50, "STAT", "EXIST_GAIN", "", "5티어: 존재력획득량"),
    ]
    rows = []
    for i, (tier, order_from, order_to, effect_type, stat_type, grant_currency, kor_name) in enumerate(specs, start=1):
        if effect_type == "STAT":
            value_base = stat_value(order_from)
            value_per_node = 0.6  # 원본 "10노드마다 +3" 계단 패턴의 선형 근사치
        else:
            value_base = currency_amount(order_from)
            value_per_node = 1.0  # 원본 "10노드마다 +5" 계단 패턴의 선형 근사치

        rows.append(
            [
                i,
                30000 + i,
                kor_name,
                tier,
                order_from,
                order_to,
                effect_type,
                stat_type or None,
                grant_currency or None,
                value_base,
                value_per_node,
                node_cost(order_from),
                1.35,
                (
                    f"order {order_from}~{order_to} 구간. 원본 노드별 5종 순환 효과를 티어 단위 단일 효과로 단순화함"
                    " — 다음 단계 리팩터링 시 재검토 필요"
                ),
            ]
        )
    return rows


# ---------------------------------------------------------------------------
# FeatureUnlockTable
# ---------------------------------------------------------------------------

FEATURE_UNLOCK_TABLE_COLUMNS = register(
    "FeatureUnlockTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용)"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "특별 해금 고유 ID (31000번대)"},
        {"eng": "//Name", "kor": "이름", "type": "string", "ref": "", "desc": "행 구분용 참고 이름 (파싱 제외)"},
        {
            "eng": "FeatureType",
            "kor": "기능 종류",
            "type": "enum",
            "ref": "EnumDefine/FeatureType",
            "desc": "리버스인지 타임 하이스트인지",
        },
        {
            "eng": "Name",
            "kor": "이름ID",
            "type": "int",
            "ref": "StringTable/Id",
            "desc": "화면에 표시할 기능 이름의 StringTable ID",
        },
        {
            "eng": "RequireNodeCount",
            "kor": "필요 노드 수",
            "type": "int",
            "ref": "",
            "desc": "이 기능이 나타나는 데 필요한 존재력 트리 해금 개수",
        },
        {"eng": "UnlockCost", "kor": "해금 비용", "type": "int", "ref": "", "desc": "해금에 필요한 존재력"},
        {"eng": "//Description", "kor": "설명", "type": "string", "ref": "", "desc": "행에 대한 참고 설명 (파싱 제외)"},
    ],
)


def build_feature_unlock_rows() -> list[list]:
    return [
        [1, 31001, "리버스", "REBIRTH", 40007, 15, node_cost(15), "트리 15노드 해금 시 등장"],
        [2, 31002, "타임 하이스트", "TIME_HEIST", 40008, 33, node_cost(33), "트리 33노드 해금 시 등장"],
    ]


# ---------------------------------------------------------------------------
# EquipmentTable
# ---------------------------------------------------------------------------

EQUIPMENT_TABLE_COLUMNS = register(
    "EquipmentTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용)"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "장비 부위 고유 ID (32000번대)"},
        {"eng": "//Name", "kor": "이름", "type": "string", "ref": "", "desc": "행 구분용 참고 이름 (파싱 제외)"},
        {"eng": "EquipSlot", "kor": "부위", "type": "enum", "ref": "EnumDefine/EquipSlot", "desc": "5부위 중 어떤 부위인지"},
        {
            "eng": "Name",
            "kor": "이름ID",
            "type": "int",
            "ref": "StringTable/Id",
            "desc": "화면에 표시할 부위 이름의 StringTable ID",
        },
        {
            "eng": "StatType",
            "kor": "적용 스탯",
            "type": "enum",
            "ref": "EnumDefine/StatType",
            "desc": "이 부위 강화 시 오르는 스탯 (ATK 또는 DEF)",
        },
        {"eng": "ValuePerLevel", "kor": "레벨당 상승치", "type": "float", "ref": "", "desc": "강화 1레벨당 상승하는 스탯 값"},
        {"eng": "CostBase", "kor": "기준 비용", "type": "int", "ref": "", "desc": "레벨 0→1 강화 비용(골드)"},
        {
            "eng": "CostGrowthRate",
            "kor": "비용 증가율",
            "type": "float",
            "ref": "",
            "desc": "비용 = CostBase × CostGrowthRate^현재레벨",
        },
        {
            "eng": "MaxLevel",
            "kor": "최대 레벨",
            "type": "int",
            "ref": "",
            "desc": "레벨 상한. 현재는 실질적 상한 없음을 뜻하는 자리 표시자(9999)",
        },
    ],
)


def build_equipment_rows() -> list[list]:
    # (slot, 한글명, stringId, statType)
    specs = [
        ("Weapon", "무기", 40009, "ATK"),
        ("Helmet", "투구", 40010, "DEF"),
        ("Armor", "갑옷", 40011, "DEF"),
        ("Gloves", "장갑", 40012, "ATK"),
        ("Boots", "신발", 40013, "DEF"),
    ]
    rows = []
    for i, (slot, kor_name, string_id, stat_type) in enumerate(specs, start=1):
        rows.append([i, 32000 + i, kor_name, slot, string_id, stat_type, 2, 15, 1.22, 9999])
    return rows


# ---------------------------------------------------------------------------
# MasteryTable
# ---------------------------------------------------------------------------

MASTERY_TABLE_COLUMNS = register(
    "MasteryTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용)"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "무기 숙련 고유 ID (33000번대)"},
        {"eng": "//Name", "kor": "이름", "type": "string", "ref": "", "desc": "행 구분용 참고 이름 (파싱 제외)"},
        {
            "eng": "WeaponId",
            "kor": "무기ID",
            "type": "int",
            "ref": "",
            "desc": "내부 무기 식별자. 지금은 1종(기본 검)뿐이지만 추가 확장 대비",
        },
        {
            "eng": "Name",
            "kor": "이름ID",
            "type": "int",
            "ref": "StringTable/Id",
            "desc": "화면에 표시할 무기 이름의 StringTable ID",
        },
        {
            "eng": "AtkMultiplierPerLevel",
            "kor": "레벨당 ATK 배율",
            "type": "float",
            "ref": "",
            "desc": "숙련 1레벨당 증가하는 ATK 배율 (0.05 = +5%)",
        },
        {"eng": "CostBase", "kor": "기준 비용", "type": "int", "ref": "", "desc": "레벨 0→1 숙련 비용(숙련의 정수)"},
        {
            "eng": "CostGrowthRate",
            "kor": "비용 증가율",
            "type": "float",
            "ref": "",
            "desc": "비용 = CostBase × CostGrowthRate^현재레벨",
        },
        {
            "eng": "MaxLevel",
            "kor": "최대 레벨",
            "type": "int",
            "ref": "",
            "desc": "레벨 상한. 현재는 실질적 상한 없음을 뜻하는 자리 표시자(9999)",
        },
    ],
)


def build_mastery_rows() -> list[list]:
    return [[1, 33001, "기본 검", 1, 40014, 0.05, 10, 1.25, 9999]]


# ---------------------------------------------------------------------------
# TimeHeistTable
# ---------------------------------------------------------------------------

TIME_HEIST_TABLE_COLUMNS = register(
    "TimeHeistTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용)"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "타임 하이스트 고유 ID (34000번대)"},
        {"eng": "//Name", "kor": "이름", "type": "string", "ref": "", "desc": "행 구분용 참고 이름 (파싱 제외)"},
        {"eng": "CostBase", "kor": "기준 비용", "type": "int", "ref": "", "desc": "1회차 사용 비용(시간에너지)"},
        {
            "eng": "CostGrowthRate",
            "kor": "비용 증가율",
            "type": "float",
            "ref": "",
            "desc": "비용 = CostBase × CostGrowthRate^사용횟수",
        },
        {"eng": "CooldownBase", "kor": "기준 쿨타임(초)", "type": "int", "ref": "", "desc": "1회차 사용 후 쿨타임 기준값(초)"},
        {
            "eng": "CooldownGrowthRate",
            "kor": "쿨타임 증가율",
            "type": "float",
            "ref": "",
            "desc": "쿨타임 = CooldownBase × CooldownGrowthRate^사용횟수",
        },
        {
            "eng": "TargetStageOffset",
            "kor": "선취 스테이지 오프셋",
            "type": "int",
            "ref": "",
            "desc": "현재 스테이지 + 이 값 = 선취할 미래 스테이지",
        },
        {
            "eng": "RewardMultiplier",
            "kor": "보상 배율",
            "type": "float",
            "ref": "",
            "desc": "선취 스테이지를 몇 클리어분으로 환산해 보상을 줄지",
        },
        {"eng": "//Description", "kor": "설명", "type": "string", "ref": "", "desc": "행에 대한 참고 설명 (파싱 제외)"},
    ],
)


def build_time_heist_rows() -> list[list]:
    return [[1, 34001, "타임 하이스트", 20, 2.0, 7200, 1.5, 10, 5, "미래 스테이지 보상을 시간에너지로 미리 수령"]]


# ---------------------------------------------------------------------------
# RebirthTable
# ---------------------------------------------------------------------------

REBIRTH_TABLE_COLUMNS = register(
    "RebirthTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용)"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "리버스 고유 ID (35000번대)"},
        {"eng": "//Name", "kor": "이름", "type": "string", "ref": "", "desc": "행 구분용 참고 이름 (파싱 제외)"},
        {"eng": "ResetStage", "kor": "스테이지 초기화", "type": "bool", "ref": "", "desc": "실행 시 스테이지를 1로 되돌리는지"},
        {"eng": "ResetStats", "kor": "스탯 초기화", "type": "bool", "ref": "", "desc": "실행 시 6스탯 레벨을 초기화하는지"},
        {
            "eng": "ResetEquipment",
            "kor": "장비 초기화",
            "type": "bool",
            "ref": "",
            "desc": "실행 시 장비 강화 레벨을 초기화하는지",
        },
        {"eng": "ResetMastery", "kor": "숙련 초기화", "type": "bool", "ref": "", "desc": "실행 시 무기 숙련 레벨을 초기화하는지"},
        {
            "eng": "RefundGrowthEnergy",
            "kor": "성장에너지 환급",
            "type": "bool",
            "ref": "",
            "desc": "그동안 소비한 성장에너지를 전액 돌려주는지",
        },
        {"eng": "RefundGold", "kor": "골드 환급", "type": "bool", "ref": "", "desc": "그동안 소비한 골드를 전액 돌려주는지"},
        {
            "eng": "RefundMasteryEssence",
            "kor": "숙련의정수 환급",
            "type": "bool",
            "ref": "",
            "desc": "그동안 소비한 숙련의 정수를 전액 돌려주는지",
        },
        {
            "eng": "KeepExistTree",
            "kor": "존재력트리 유지",
            "type": "bool",
            "ref": "",
            "desc": "존재력 트리 해금 상태를 초기화하지 않고 유지하는지",
        },
        {"eng": "//Description", "kor": "설명", "type": "string", "ref": "", "desc": "행에 대한 참고 설명 (파싱 제외)"},
        {
            "eng": "BonusBase",
            "kor": "회차 보너스 계수",
            "type": "float",
            "ref": "",
            "desc": "회차 보너스 포인트 공식의 기준 계수. 포인트 = floor(BonusBase × 도달스테이지^BonusExponent)",
        },
        {
            "eng": "BonusExponent",
            "kor": "회차 보너스 지수",
            "type": "float",
            "ref": "",
            "desc": "회차 보너스 포인트 공식에서 도달 스테이지에 적용하는 지수",
        },
        {
            "eng": "BonusPerPoint",
            "kor": "포인트당 스탯 상승률",
            "type": "float",
            "ref": "",
            "desc": "누적 보너스 포인트 1당 전 스탯에 곱연산으로 붙는 상승률(%). 전 스탯 보너스율 = 누적 포인트 × 이 값",
        },
        {
            "eng": "MinStageForBonus",
            "kor": "보너스 최소 스테이지",
            "type": "int",
            "ref": "",
            "desc": "리버스 시점의 도달 스테이지가 이 값 미만이면 보너스 포인트를 얻지 못함",
        },
        {
            "eng": "//BonusDescription",
            "kor": "보너스 설명",
            "type": "string",
            "ref": "",
            "desc": "회차 보너스 공식에 대한 참고 설명 (파싱 제외)",
        },
    ],
)


def build_rebirth_rows() -> list[list]:
    return [
        [
            1,
            35001,
            "리버스",
            True,
            True,
            True,
            True,
            True,
            True,
            True,
            True,
            "스테이지/스탯/장비/숙련 초기화 + 소비 재화 전액 환급. 존재력 트리는 유지",
            1.0,
            0.5,
            1.0,
            10,
            "포인트 = floor(1.0 × 도달스테이지^0.5), 10스테이지 미만이면 0. 전 스탯 보너스율(%) = 누적 포인트 × 1.0",
        ]
    ]


# ---------------------------------------------------------------------------
# CommonTable (key-value)
# ---------------------------------------------------------------------------

COMMON_TABLE_COLUMNS = register(
    "CommonTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용)"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "공용 상수 고유 ID (36000번대)"},
        {"eng": "Key", "kor": "키", "type": "string", "ref": "", "desc": "코드가 참조하는 식별자. 절대 수정 금지"},
        {"eng": "//Name", "kor": "이름", "type": "string", "ref": "", "desc": "행 구분용 참고 이름 (파싱 제외)"},
        {"eng": "Value", "kor": "값", "type": "float", "ref": "", "desc": "실제 값. 수정 대상"},
        {"eng": "ValueType", "kor": "값 타입", "type": "string", "ref": "", "desc": "Value를 int/float 중 무엇으로 해석할지"},
        {"eng": "//Description", "kor": "설명", "type": "string", "ref": "", "desc": "행에 대한 참고 설명 (파싱 제외)"},
    ],
)


def build_common_rows() -> list[list]:
    specs = [
        ("OfflineMaxHours", "오프라인 최대 인정 시간", 8, "int", "오프라인 보상으로 인정하는 최대 시간(시간)"),
        ("OfflineRewardMultiplier", "오프라인 보상 계수", 1, "float", "오프라인 보상 전체에 곱해지는 배율"),
        ("InitialGold", "초기 골드", 0, "int", "게임 시작 시 지급되는 초기 골드"),
        ("InitialGrowthEnergy", "초기 성장에너지", 0, "int", "게임 시작 시 지급되는 초기 성장에너지"),
        ("InitialExist", "초기 존재력", 0, "int", "게임 시작 시 지급되는 초기 존재력"),
        ("InitialTimeEnergy", "초기 시간에너지", 0, "int", "게임 시작 시 지급되는 초기 시간에너지"),
        ("InitialMasteryEssence", "초기 숙련의정수", 0, "int", "게임 시작 시 지급되는 초기 숙련의 정수"),
        ("AutoSaveIntervalSec", "자동저장 간격(초)", 2, "float", "상태 변경 후 실제 저장까지의 최소 대기 간격"),
    ]
    rows = []
    for i, (key, kor_name, value, value_type, desc) in enumerate(specs, start=1):
        rows.append([i, 36000 + i, key, kor_name, value, value_type, desc])
    return rows


# ---------------------------------------------------------------------------
# StringTable
# ---------------------------------------------------------------------------

STRING_TABLE_COLUMNS = register(
    "StringTable",
    [
        {"eng": "Index", "kor": "순번", "type": "int", "ref": "", "desc": "행 순번(표시용)"},
        {"eng": "Id", "kor": "ID", "type": "int", "ref": "", "desc": "문자열 고유 ID (40000번대). 다른 테이블의 이름ID가 참조"},
        {"eng": "KOR", "kor": "한국어", "type": "string", "ref": "", "desc": "한국어 표시 문자열"},
        {"eng": "ENG", "kor": "영문", "type": "string", "ref": "", "desc": "영문/내부 키 표시 문자열"},
        {"eng": "//Category", "kor": "분류", "type": "string", "ref": "", "desc": "문자열 용도 분류 (파싱 제외)"},
    ],
)


def build_string_rows() -> list[list]:
    specs = [
        (40001, "공격력", "ATK", "Stat"),
        (40002, "방어력", "DEF", "Stat"),
        (40003, "공격속도", "ASPD", "Stat"),
        (40004, "치명타 확률", "CRIT", "Stat"),
        (40005, "치명타피해", "CRIT_DMG", "Stat"),
        (40006, "존재력 획득량", "EXIST_GAIN", "Stat"),
        (40007, "리버스", "REBIRTH", "System"),
        (40008, "타임 하이스트", "TIME_HEIST", "System"),
        (40009, "무기", "Weapon", "EquipSlot"),
        (40010, "투구", "Helmet", "EquipSlot"),
        (40011, "갑옷", "Armor", "EquipSlot"),
        (40012, "장갑", "Gloves", "EquipSlot"),
        (40013, "신발", "Boots", "EquipSlot"),
        (40014, "기본 검", "Basic Sword", "Weapon"),
        (40015, "존재력", "EXIST", "Currency"),
        (40016, "성장에너지", "GROWTH_ENERGY", "Currency"),
        (40017, "숙련의 정수", "MASTERY_ESSENCE", "Currency"),
        (40018, "시간에너지", "TIME_ENERGY", "Currency"),
        (40019, "골드", "GOLD", "Currency"),
        (40020, "존재력 트리", "EXIST_TREE", "System"),
        # 재화 축약형 — 공간이 좁은 목록(예: 리버스 환급 목록)에서 사용
        (40021, "존재", "EXIST_ABBR", "CurrencyAbbr"),
        (40022, "성장", "GROWTH_ABBR", "CurrencyAbbr"),
        (40023, "시간", "TIME_ABBR", "CurrencyAbbr"),
        (40024, "골드", "GOLD_ABBR", "CurrencyAbbr"),
        (40025, "정수", "ESSENCE_ABBR", "CurrencyAbbr"),
        # 하단 메뉴 탭 이름
        (40026, "성장", "Growth", "Tab"),
        (40027, "장비", "Equipment", "Tab"),
        (40028, "가챠", "Gacha", "Tab"),
        (40029, "존재력", "ExistTree", "Tab"),
        (40030, "도감", "Dogam", "Tab"),
        # 공용 버튼 라벨
        (40031, "닫기", "Close", "Button"),
        (40032, "취소", "Cancel", "Button"),
        (40033, "확인", "Confirm", "Button"),
        (40034, "실행", "Execute", "Button"),
        (40035, "강탈", "Steal", "Button"),
        (40036, "받기", "Claim", "Button"),
        (40037, "해금", "Unlock", "Button"),
        (40038, "강화", "Enhance", "Button"),
        (40039, "수련", "Train", "Button"),
        (40040, "업그레이드", "Upgrade", "Button"),
        (40041, "최대로", "MaxAll", "Button"),
        (40042, "뒤로", "Back", "Button"),
        # 공용 상태 라벨
        (40043, "잠김", "Locked", "State"),
        (40044, "해금됨", "Unlocked", "State"),
        (40045, "사용 가능", "Available", "State"),
        (40046, "티어", "Tier", "State"),
        (40047, "효과", "Effect", "State"),
        (40048, "비용", "Cost", "State"),
        # 리버스 회차 보너스
        (40049, "회차 보너스", "RebirthBonus", "RebirthBonus"),
        (40050, "현재 회차", "CurrentCycle", "RebirthBonus"),
        (40051, "누적 포인트", "TotalPoints", "RebirthBonus"),
        (40052, "획득 예정 포인트", "PendingPoints", "RebirthBonus"),
        (40053, "전 스탯 보너스", "AllStatBonus", "RebirthBonus"),
        (40054, "최고 도달 스테이지", "MaxStageReached", "RebirthBonus"),
    ]
    rows = []
    for i, (string_id, kor, eng, category) in enumerate(specs, start=1):
        rows.append([i, string_id, kor, eng, category])
    return rows


# ===========================================================================
# #EnumDefine
# ===========================================================================

ENUM_DEFINE_HEADERS = ["enum 그룹", "한글 라벨", "영문 라벨", "사용처"]

ENUM_USAGE = {
    "CurrencyType": "ExistTreeTable.GrantCurrency",
    "StatType": "StatTable.StatType, ExistTreeTable.StatType, EquipmentTable.StatType",
    "NodeEffectType": "ExistTreeTable.EffectType",
    "EquipSlot": "EquipmentTable.EquipSlot",
    "StageType": "StageTable.StageType",
    "FeatureType": "FeatureUnlockTable.FeatureType",
}


def build_enum_define_rows() -> list[list]:
    groups = [
        ("CurrencyType", [("존재력", "EXIST"), ("성장에너지", "GROWTH_ENERGY"), ("숙련의정수", "MASTERY_ESSENCE"), ("시간에너지", "TIME_ENERGY"), ("골드", "GOLD")]),
        ("StatType", [("공격력", "ATK"), ("방어력", "DEF"), ("공격속도", "ASPD"), ("치명타확률", "CRIT"), ("치명타피해", "CRIT_DMG"), ("존재력획득량", "EXIST_GAIN")]),
        ("NodeEffectType", [("스탯상승", "STAT"), ("재화지급", "GRANT")]),
        ("EquipSlot", [("무기", "Weapon"), ("투구", "Helmet"), ("갑옷", "Armor"), ("장갑", "Gloves"), ("신발", "Boots")]),
        ("StageType", [("일반", "Normal"), ("보스", "Boss")]),
        ("FeatureType", [("리버스", "REBIRTH"), ("타임하이스트", "TIME_HEIST")]),
    ]
    rows = []
    for group_name, values in groups:
        for kor_label, eng_label in values:
            rows.append([group_name, kor_label, eng_label, ENUM_USAGE[group_name]])
    return rows


# ===========================================================================
# #TableDefine — 위에서 register()로 쌓인 모든 테이블 스키마를 그대로 펼친다
# ===========================================================================

TABLE_DEFINE_HEADERS = ["테이블명", "칼럼", "칼럼명(영문)", "자료형", "칼럼 설명", "비고"]


def build_table_define_rows() -> list[list]:
    rows = []
    for table_name, columns in TABLE_REGISTRY:
        for col in columns:
            rows.append([table_name, col["kor"], col["eng"], col["type"], col["desc"], col["ref"]])
    # EnumDefine 자체의 칼럼도 문서화
    for kor, desc in [
        ("enum 그룹", "enum 값이 속한 그룹 이름"),
        ("한글 라벨", "기획 문서/화면에 쓰는 한글 표기"),
        ("영문 라벨", "코드가 참조하는 영문 값"),
        ("사용처", "이 enum 그룹을 참조하는 테이블.칼럼 목록"),
    ]:
        rows.append(["#EnumDefine", kor, "", "string", desc, ""])
    return rows


# ===========================================================================
# 메인
# ===========================================================================


def main() -> None:
    wb = Workbook()
    wb.remove(wb.active)  # 기본 생성되는 빈 시트 제거

    # 순서대로 생성 — #TableDefine/#EnumDefine은 아래 데이터 테이블들의 스키마가
    # 먼저 register()로 채워진 뒤에 만들어야 하므로 실제 append는 맨 뒤에서 한다.
    data_sheets: list[tuple[str, list[dict], list[list]]] = [
        ("StageTable", STAGE_TABLE_COLUMNS, build_stage_rows()),
        ("StatTable", STAT_TABLE_COLUMNS, build_stat_rows()),
        ("ExistTreeTable", EXIST_TREE_TABLE_COLUMNS, build_exist_tree_rows()),
        ("FeatureUnlockTable", FEATURE_UNLOCK_TABLE_COLUMNS, build_feature_unlock_rows()),
        ("EquipmentTable", EQUIPMENT_TABLE_COLUMNS, build_equipment_rows()),
        ("MasteryTable", MASTERY_TABLE_COLUMNS, build_mastery_rows()),
        ("TimeHeistTable", TIME_HEIST_TABLE_COLUMNS, build_time_heist_rows()),
        ("RebirthTable", REBIRTH_TABLE_COLUMNS, build_rebirth_rows()),
        ("CommonTable", COMMON_TABLE_COLUMNS, build_common_rows()),
        ("StringTable", STRING_TABLE_COLUMNS, build_string_rows()),
    ]

    write_meta_sheet(wb, "#TableDefine", TABLE_DEFINE_HEADERS, build_table_define_rows())
    write_meta_sheet(wb, "#EnumDefine", ENUM_DEFINE_HEADERS, build_enum_define_rows())

    for sheet_name, columns, rows in data_sheets:
        write_data_sheet(wb, sheet_name, columns, rows)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    wb.save(OUTPUT_PATH)

    print(f"balance.xlsx 생성 완료: {os.path.abspath(OUTPUT_PATH)}")
    print(f"시트 {len(wb.sheetnames)}개:")
    for name in wb.sheetnames:
        ws = wb[name]
        print(f"  - {name}: {ws.max_row}행 x {ws.max_column}열")


if __name__ == "__main__":
    main()
