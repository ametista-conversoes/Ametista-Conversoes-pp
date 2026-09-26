import { useState } from 'react'
import { AlertTriangle, FolderKanban } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GoalsProgressCard } from '@/components/dashboard/GoalsProgressCard'
import { ProjectInfoCards } from '@/components/project/ProjectInfoCards'
import { UnlinkedClientNotice } from '@/components/shared/UnlinkedClientNotice'
import { TaskList } from '@/components/tasks/TaskList'
import { useAuth } from '@/contexts/AuthContext'
import { useClient, useProjectProblems, useProjects, useSmartGoals, useTasks } from '@/hooks/useClientPortalData'
import { effectiveTaskStatus } from '@/lib/recurrence'
import { cn } from '@/lib/utils'
import { projectStatusLabels, projectStatusStyles } from '@/lib/status-styles'

export default function Project() {
  const { clientId } = useAuth()
  const { data: client, isLoading: loadingClient, isError: clientIsError } = useClient()
  const { data: projects, isLoading: loadingProjects, isError: projectsIsError } = useProjects()
  const { data: tasks } = useTasks()
  const { data: goals } = useSmartGoals()
  const { data: projectProblems } = useProjectProblems()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  if (!clientId) {
    return <UnlinkedClientNotice page="um Projeto" />
  }

  if (loadingClient || loadingProjects) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  if (clientIsError || projectsIsError) {
    return <p className="text-sm text-destructive">Erro ao carregar os dados. Tente novamente.</p>
  }

  const projectList = projects ?? []
  const mostRecentProject = [...projectList].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))[0]
  const project = projectList.find((p) => p.id === selectedProjectId) ?? mostRecentProject

  if (!client || !project) {
    return (
      <div className="rounded-xl border border-[#1A2540] bg-[#131C31] p-6 text-sm text-muted-foreground">
        Ainda não há nenhum projeto cadastrado para esta conta.
      </div>
    )
  }

  // Fase 35 — mesmo status "efetivo" de Tasks.tsx: tarefa recorrente
  // concluída volta a aparecer como "todo" sozinha quando vence.
  const projectTasks = (tasks ?? [])
    .filter((task) => task.project_id === project.id)
    .map((task) => ({
      ...task,
      status: effectiveTaskStatus(task.status, task.recurrence_interval, task.completed_at, client?.plan ?? null),
    }))

  // Fase 40.1 — "Projeto com problemas": campanha vinculada pausada/
  // removida no Google/Meta Ads. Sem prazo de expiração aqui de
  // propósito — só some quando o gestor dispensa ou a campanha volta a
  // ficar ativa (ver useProjectProblems).
  const projectsWithProblems = new Set((projectProblems ?? []).map((p) => p.project_id))
  const currentProjectHasProblem = projectsWithProblems.has(project.id)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Portal Cliente</p>
        <h1 className="text-2xl font-semibold text-foreground">Projetos</h1>
      </div>

      {projectList.length > 1 && (
        <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
          <CardHeader className="p-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4 text-purple-400" />
              Todos os Projetos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-0 pt-4">
            {projectList.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={cn(
                  'cursor-pointer rounded-lg bg-secondary/50 px-3 py-2 hover:bg-secondary',
                  p.id === project.id && 'border border-purple-600/20 bg-purple-600/15',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{p.title}</p>
                  <div className="flex items-center gap-1">
                    {projectsWithProblems.has(p.id) && (
                      <Badge className="gap-1 border-orange-500/20 bg-orange-500/10 text-orange-400">
                        <AlertTriangle className="h-3 w-3" />
                        Projeto com problemas
                      </Badge>
                    )}
                    <Badge className={projectStatusStyles[p.status]}>{projectStatusLabels[p.status] ?? p.status}</Badge>
                  </div>
                </div>
                {p.objective && <p className="mt-1 text-xs text-muted-foreground">{p.objective}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{project.title}</h2>
          {currentProjectHasProblem && (
            <Badge className="gap-1 border-orange-500/20 bg-orange-500/10 text-orange-400">
              <AlertTriangle className="h-3 w-3" />
              Projeto com problemas
            </Badge>
          )}
        </div>
        <div className="space-y-6">
          <ProjectInfoCards client={client} project={project} />

          <div className="content-grid-container">
            <div className="content-grid gap-4">
              <GoalsProgressCard goals={goals ?? []} />
              <TaskList tasks={projectTasks} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
