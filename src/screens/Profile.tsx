import { TabBar } from '@/components/TabBar';
import { Tree } from '@/components/Tree';
import { C, Txt } from '@/components/Txt';
import { ProgressBar, Screen } from '@/components/ui';
import { daysToNextStage, isThirsty, TREE_STAGES, treeStage } from '@/core/tree';
import { LEVELS } from '@/core/types';
import { levelTotal, todayCount, totalWords, useStore } from '@/store/store';

/** 7 · Profil */
export function Profile() {
  const learnedBy = useStore((s) => s.learned);
  const today = useStore((s) => todayCount(s));
  const dailyGoal = useStore((s) => s.settings.dailyGoal);
  const garden = useStore((s) => s.garden);

  const learned = LEVELS.reduce((n, l) => n + learnedBy[l], 0);
  const total = totalWords();
  const stage = treeStage(garden.days);
  const thirsty = isThirsty(garden);
  const next = daysToNextStage(garden.days);
  const goalDone = today >= dailyGoal;

  let treeNote: string;
  if (garden.days === 0) treeNote = 'Günlük hedefini ilk kez tamamladığında tohumun filizlenecek.';
  else if (thirsty) treeNote = 'Ağacın susadı. Bugün hedefini tamamla, yeniden canlansın.';
  else if (next) treeNote = `${next.days} gün daha hedefini tamamlarsan: ${next.name}`;
  else treeNote = 'Ağacın tam olgunluğa ulaştı. Sulamaya devam!';

  return (
    <Screen>
      <Txt variant="display" size={44} style={{ marginTop: 8 }}>
        Profil
      </Txt>

      <div className="scroll" style={{ paddingBottom: 16 }}>
        <div className="card row" style={{ marginTop: 24, padding: 16, borderRadius: 28, gap: 12 }}>
          <Tree stage={stage} thirsty={thirsty} size={150} />
          <div className="col" style={{ flex: 1, gap: 6 }}>
            <Txt variant="caps" size={13}>
              Ağacın
            </Txt>
            <Txt variant="display" size={26}>
              {TREE_STAGES[stage].name}
            </Txt>
            <Txt variant="medium" size={14} color={C.textMuted}>
              {garden.days} gün sulandı · bugün {goalDone ? 'sulandı' : `${Math.max(0, dailyGoal - today)} doğru kaldı`}
            </Txt>
            <Txt size={14} color={C.textMuted}>
              {treeNote}
            </Txt>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: 22, borderRadius: 28, background: C.accent }}>
          <Txt variant="bold" size={15} color={C.onAccent}>
            Öğrenilen kelime
          </Txt>
          <div className="row" style={{ alignItems: 'baseline', gap: 10, marginTop: 4, marginBottom: 16 }}>
            <Txt variant="display" size={72} color={C.onAccent}>
              {learned}
            </Txt>
            <Txt variant="medium" size={16} color={C.onAccent}>
              / {total}
            </Txt>
          </div>
          <ProgressBar value={total ? learned / total : 0} track={C.onAccentTrack} fill={C.onAccent} />
          <Txt variant="medium" size={14} color={C.onAccent} style={{ marginTop: 12 }}>
            Bugün {today} / {dailyGoal} doğru cevap
          </Txt>
        </div>

        <Txt variant="caps" size={14} style={{ marginTop: 28, marginBottom: 12 }}>
          Seviyelere göre
        </Txt>
        <div className="col" style={{ gap: 18 }}>
          {LEVELS.map((level) => {
            const t = levelTotal(level);
            return (
              <div key={level} className="row" style={{ gap: 14 }}>
                <Txt variant="display" size={22} style={{ width: 36 }}>
                  {level}
                </Txt>
                <div style={{ flex: 1 }}>
                  <ProgressBar value={t ? learnedBy[level] / t : 0} />
                </div>
                <Txt variant="medium" size={15} color={C.textMuted} style={{ minWidth: 80, textAlign: 'right' }}>
                  {learnedBy[level]} / {t}
                </Txt>
              </div>
            );
          })}
        </div>
        <Txt size={13} color={C.textMuted} style={{ marginTop: 18 }}>
          Bir kelime farklı günlerde 4 kez doğru bilinince öğrenilmiş sayılır. Öğrenilen kelimeler de aralıklarla tekrar
          sorulur.
        </Txt>
      </div>

      <TabBar active="profile" />
    </Screen>
  );
}
