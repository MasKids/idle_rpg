import { useState, type ComponentType, type ReactNode } from 'react'
import { CURRENCY_ICON, SYSTEM_ICON, STATE_ICON, TAB_ICON, WEAPON_ICON } from '../components/icons'
import { Button, Card, CostLabel, CurrencyChip, EmptyState, GradeBadge, Modal, ProgressBar } from '../components/ui'
import { getCurrencyName } from '../data/uiStrings'
import type { CurrencyKey } from '../types/game'
import type { WeaponGradeEnum } from '../data/balance'

// 다크 미니멀 디자인 시스템(토큰/아이콘/공용 컴포넌트)을 한 화면에서 눈으로 확인하는
// 개발자 전용 페이지. 실제 게임 화면(App.tsx의 탭 트리)과는 완전히 분리돼 있고,
// DevPanel의 "디자인 시스템" 버튼으로만 진입한다 — 이 파일이 존재한다고 해서 기존
// 화면 레이아웃이 바뀌지는 않는다. 열람 방법은 docs/DESIGN_SYSTEM.md 참고.
export function DesignSystemPreview({ onClose }: { onClose: () => void }) {
  const [isModalOpen, setModalOpen] = useState(false)

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-surface-base text-text-primary">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-border bg-surface-base/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-lg font-semibold">디자인 시스템</h1>
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      </div>

      <div className="flex flex-col gap-8 p-4 pb-16">
        <Section title="타이포그래피">
          <div className="flex flex-col gap-2">
            <TypeSample sizeClass="text-[28px]" label="2xl · 28px — 큰 재화 합계 등" />
            <TypeSample sizeClass="text-[22px]" label="xl · 22px — 화면 타이틀" />
            <TypeSample sizeClass="text-[18px]" label="lg · 18px — 섹션 타이틀" />
            <TypeSample sizeClass="text-[15px]" label="base · 15px — 본문" />
            <TypeSample sizeClass="text-[13px]" label="sm · 13px — 보조 본문" />
            <TypeSample sizeClass="text-[11px]" label="xs · 11px — 캡션/라벨" />
            <div className="mt-2 text-[13px] text-text-secondary">
              숫자 자릿수 흔들림 방지: <span className="font-semibold tabular-nums text-text-primary">0123456789</span>{' '}
              (전역 tabular-nums 적용됨)
            </div>
          </div>
        </Section>

        <Section title="배경 계층 4단계">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Swatch className="bg-surface-base" label="surface-base" hex="#0A0A0F" />
            <Swatch className="bg-surface-card" label="surface-card" hex="#131318" />
            <Swatch className="bg-surface-elevated" label="surface-elevated" hex="#1C1C24" />
            <Swatch className="border-2 border-surface-border bg-surface-base" label="surface-border" hex="#2A2A35" />
          </div>
        </Section>

        <Section title="텍스트 계층 3단계">
          <div className="flex flex-col gap-1 rounded-lg bg-surface-card p-3">
            <span className="text-text-primary">text-primary — 주요 텍스트</span>
            <span className="text-text-secondary">text-secondary — 보조 텍스트</span>
            <span className="text-text-disabled">text-disabled — 비활성 텍스트</span>
          </div>
        </Section>

        <Section title="기능 색상 — 화면 톤">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AccentGroup name="청록 (전체화면 드릴다운 — 무기고/존재력)" soft="bg-teal-soft" base="bg-teal-base" strong="bg-teal-strong" />
            <AccentGroup name="금색 (가챠/타임 하이스트)" soft="bg-gold-soft" base="bg-gold-base" strong="bg-gold-strong" />
            <AccentGroup name="파랑 (일반 UI 포인트)" soft="bg-blue-soft" base="bg-blue-base" strong="bg-blue-strong" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch className="bg-danger-base" label="danger-base" hex="#DC2626" />
            <Swatch className="bg-danger-strong" label="danger-strong" hex="#F87171" />
            <Swatch className="bg-success-base" label="success-base" hex="#16A34A" />
            <Swatch className="bg-success-strong" label="success-strong" hex="#4ADE80" />
          </div>
        </Section>

        <Section title="무기 등급 5색 / 유물 등급 3색 (Normal·Rare·Epic 공유)">
          <div className="flex flex-wrap gap-2">
            {(['Normal', 'Rare', 'Epic', 'Unique', 'Legendary'] satisfies WeaponGradeEnum[]).map((grade) => (
              <GradeBadge key={grade} grade={grade} />
            ))}
          </div>
        </Section>

        <Section title="재화 6종 색상 + 아이콘">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(CURRENCY_ICON) as CurrencyKey[]).map((key) => (
              <CurrencyChip key={key} currency={key} amount={key === 'exist' ? 1234567 : 4200} />
            ))}
          </div>
          <div className="mt-1 text-[11px] text-text-disabled">{'표시 이름: ' + (Object.keys(CURRENCY_ICON) as CurrencyKey[]).map((k) => getCurrencyName(k)).join(' · ')}</div>
        </Section>

        <Section title="아이콘 — lucide-react + 커스텀(창/활/유물)">
          <IconGrid
            items={[
              ...Object.entries(WEAPON_ICON),
              ...Object.entries(TAB_ICON),
              ...Object.entries(SYSTEM_ICON),
              ...Object.entries(STATE_ICON),
            ]}
          />
        </Section>

        <Section title="Button (primary / secondary / gold, disabled 포함)">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="gold">Gold</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </Section>

        <Section title="Card">
          <Card className="max-w-xs">
            <p className="text-sm text-text-primary">기본 카드(surface-card)</p>
            <p className="mt-1 text-xs text-text-secondary">본문 텍스트는 text-secondary</p>
          </Card>
          <Card elevated className="mt-2 max-w-xs">
            <p className="text-sm text-text-primary">강조 카드(surface-elevated)</p>
          </Card>
        </Section>

        <Section title="CostLabel — TODO-UI 1번 대응">
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-surface-card p-3">
            <CostLabel currency="growthEnergy" amount={1200} />
            <CostLabel currency="gold" amount={58000} />
            <CostLabel currency="essence" amount={99999} affordable={false} />
          </div>
        </Section>

        <Section title="ProgressBar">
          <div className="flex max-w-xs flex-col gap-2">
            <ProgressBar value={3} max={5} colorClassName="bg-teal-base" />
            <ProgressBar value={5} max={5} colorClassName="bg-success-base" />
            <ProgressBar value={1} max={5} colorClassName="bg-gold-base" />
          </div>
        </Section>

        <Section title="EmptyState">
          <Card className="max-w-xs">
            <EmptyState icon={<WEAPON_ICON.Sword size={28} />} message="보유한 무기가 없습니다" description="가챠로 무기를 뽑아보세요" />
          </Card>
        </Section>

        <Section title="Modal">
          <Button onClick={() => setModalOpen(true)}>모달 열기</Button>
        </Section>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title="모달 제목"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setModalOpen(false)}>확인</Button>
          </>
        }
      >
        제목 + 내용 + 하단 버튼 영역 3단 구성.
      </Modal>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-text-secondary uppercase">{title}</h2>
      {children}
    </section>
  )
}

function TypeSample({ sizeClass, label }: { sizeClass: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${sizeClass} font-semibold text-text-primary`}>가나다 ABC 123</span>
      <span className="text-[11px] text-text-disabled">{label}</span>
    </div>
  )
}

function Swatch({ className, label, hex }: { className: string; label: string; hex: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className={`h-14 rounded-lg ${className}`} />
      <span className="text-[11px] text-text-secondary">{label}</span>
      <span className="text-[10px] text-text-disabled">{hex}</span>
    </div>
  )
}

function AccentGroup({ name, soft, base, strong }: { name: string; soft: string; base: string; strong: string }) {
  return (
    <div className="rounded-lg bg-surface-card p-2">
      <div className="mb-2 text-[11px] text-text-secondary">{name}</div>
      <div className="flex gap-1">
        <div className={`h-10 flex-1 rounded ${soft}`} />
        <div className={`h-10 flex-1 rounded ${base}`} />
        <div className={`h-10 flex-1 rounded ${strong}`} />
      </div>
    </div>
  )
}

function IconGrid({ items }: { items: [string, ComponentType<{ size?: number; strokeWidth?: number }>][] }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {items.map(([name, Icon]) => (
        <div key={name} className="flex flex-col items-center gap-1 rounded-lg bg-surface-card p-2">
          <Icon size={20} strokeWidth={2} />
          <span className="text-[10px] text-text-secondary">{name}</span>
        </div>
      ))}
    </div>
  )
}
