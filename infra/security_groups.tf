# RDS/ElastiCacheのingress許可元には、EKSがクラスタ作成時に自動で用意する
# 「クラスタセキュリティグループ」(aws_eks_cluster.main.vpc_config[0].cluster_security_group_id)を使う。
# これはコントロールプレーンと全ノードに自動アタッチされるため、自前でSGを用意してノードに付け替えるより
# 確実（自前SGをLaunch Templateで指定すると、EKS自動付与のSGが外れてノードがクラスタに参加できなくなる）。
